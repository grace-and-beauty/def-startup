/**
 * Smoke test of the migrations on plain Postgres (auth stub + migrations + seed).
 * The exhaustive RLS / RPC suite is stage 4; this proves the core contracts.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect, DEMO } from "./db";

const OTHER_OWNER = "00000000-0000-4000-8000-0000000000b1";
let db: Client;
let otherBusinessId: string;

beforeAll(async () => {
  db = await connect();
  await db.query("insert into auth.users (id, email) values ($1, 'other@example.com') on conflict do nothing", [
    OTHER_OWNER,
  ]);
  otherBusinessId = await asRole(
    db,
    "authenticated",
    OTHER_OWNER,
    async (c) => {
      // Billing columns are not even writable by owners (owner_write_limits);
      // a new business always starts on the 30-day trial.
      const { rows } = await c.query(
        `insert into public.businesses (owner_id, name, slug, niche_slug)
         values ($1, 'Other', 'other-biz', 'barbershop')
         returning id, plan, trial_ends_at < now() + interval '31 days' as trial_forced`,
        [OTHER_OWNER],
      );
      expect(rows[0].plan).toBe("trial");
      expect(rows[0].trial_forced).toBe(true);
      return rows[0].id as string;
    },
    { commit: true },
  );
});

afterAll(async () => {
  await db.query("delete from public.businesses where id = $1", [otherBusinessId]);
  await db.end();
});

describe("seed", () => {
  it("has the demo business with ~300 events", async () => {
    const { rows } = await db.query(
      `select (select count(*) from customers)::int as customers,
              (select count(*) from cards)::int as cards,
              (select count(*) from stamp_events)::int as events,
              (select count(*) from staff)::int as staff`,
    );
    expect(rows[0]).toMatchObject({ customers: 40, cards: 40, staff: 2 });
    expect(rows[0].events).toBeGreaterThan(200);
  });

  it("card counters match the event journal", async () => {
    const { rows } = await db.query(
      `select count(*)::int as bad from cards c
       where c.total_visits <> (select count(*) from stamp_events e where e.card_id = c.id and e.type = 'stamp')
          or c.rewards_redeemed <> (select count(*) from stamp_events e where e.card_id = c.id and e.type = 'reward_redeemed')`,
    );
    expect(rows[0].bad).toBe(0);
  });
});

describe("RLS", () => {
  it("another owner sees none of the demo business data", async () => {
    await asRole(db, "authenticated", OTHER_OWNER, async (c) => {
      for (const table of ["programs", "staff", "customers", "cards", "stamp_events", "messages"]) {
        const { rows } = await c.query(`select count(*)::int as n from public.${table} where business_id = $1`, [
          DEMO.businessId,
        ]);
        expect(rows[0].n, table).toBe(0);
      }
      const { rows } = await c.query("select id from public.businesses");
      expect(rows.map((r) => r.id)).toEqual([otherBusinessId]);
    });
  });

  it("another owner cannot write into the demo business", async () => {
    await expect(
      asRole(db, "authenticated", OTHER_OWNER, (c) =>
        c.query("insert into public.customers (business_id, name) values ($1, 'x')", [DEMO.businessId]),
      ),
    ).rejects.toThrow(/row-level security/);

    const updated = await asRole(db, "authenticated", OTHER_OWNER, async (c) => {
      const res = await c.query("update public.cards set stamps_count = 5 where business_id = $1", [DEMO.businessId]);
      return res.rowCount;
    });
    expect(updated).toBe(0);
  });

  it("anon has no access to tables or RPCs", async () => {
    await expect(asRole(db, "anon", null, (c) => c.query("select * from public.businesses"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asRole(db, "anon", null, (c) =>
        c.query("select * from public.apply_stamp($1, gen_random_uuid())", [DEMO.businessId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("owners cannot read staff.pin_hash", async () => {
    await expect(
      asRole(db, "authenticated", DEMO.ownerId, (c) => c.query("select pin_hash from public.staff")),
    ).rejects.toThrow(/permission denied/);
    const names = await asRole(db, "authenticated", DEMO.ownerId, async (c) => {
      const { rows } = await c.query("select name from public.staff order by name");
      return rows.map((r) => r.name);
    });
    expect(names).toHaveLength(2);
  });
});

describe("protect_billing_fields", () => {
  it("owner cannot change plan or trial_ends_at, but can rename", async () => {
    for (const patch of ["plan = 'pro'", "trial_ends_at = now() + interval '1 year'", "billing_status = 'active', canceled_at = now()"]) {
      await expect(
        asRole(db, "authenticated", DEMO.ownerId, (c) =>
          c.query(`update public.businesses set ${patch} where id = $1`, [DEMO.businessId]),
        ),
      ).rejects.toThrow(/permission denied|service role/);
    }
    const name = await asRole(db, "authenticated", DEMO.ownerId, async (c) => {
      const { rows } = await c.query("update public.businesses set name = 'Нова назва' where id = $1 returning name", [
        DEMO.businessId,
      ]);
      return rows[0].name;
    });
    expect(name).toBe("Нова назва");
  });

  it("service role can change billing fields", async () => {
    const plan = await asRole(db, "service_role", null, async (c) => {
      const { rows } = await c.query("update public.businesses set plan = 'plus' where id = $1 returning plan", [
        DEMO.businessId,
      ]);
      return rows[0].plan;
    });
    expect(plan).toBe("plus");
  });
});

describe("apply_stamp / redeem_reward", () => {
  async function freshCard(c: Client): Promise<string> {
    const { rows } = await c.query(
      `with cu as (insert into public.customers (business_id, name) values ($1, 'Test') returning id)
       insert into public.cards (business_id, program_id, customer_id, qr_token)
       select $1, $2, cu.id, 'TestToken' || substr(md5(random()::text), 1, 16) from cu
       returning id`,
      [DEMO.businessId, DEMO.programId],
    );
    return rows[0].id;
  }

  it("stamps, enforces cooldown, converts a full card into a reward and redeems it", async () => {
    await asRole(db, "service_role", null, async (c) => {
      const cardId = await freshCard(c);
      const stamp = async (cooldown: number) =>
        (
          await c.query("select * from public.apply_stamp($1, $2, $3, $4)", [
            DEMO.businessId,
            cardId,
            DEMO.staffId,
            cooldown,
          ])
        ).rows[0];

      expect(await stamp(10)).toMatchObject({ status: "ok", stamps_count: 1, total_visits: 1 });
      expect(await stamp(10)).toMatchObject({ status: "cooldown", stamps_count: 1 });
      for (let i = 2; i <= 5; i++) expect(await stamp(0)).toMatchObject({ status: "ok", stamps_count: i });
      expect(await stamp(0)).toMatchObject({ status: "ok", stamps_count: 0, rewards_available: 1, rewards_earned: 1 });

      const redeem = async () =>
        (await c.query("select * from public.redeem_reward($1, $2)", [DEMO.businessId, cardId])).rows[0];
      expect(await redeem()).toMatchObject({ status: "ok", rewards_available: 0, rewards_redeemed: 1 });
      expect(await redeem()).toMatchObject({ status: "no_reward" });

      const { rows } = await c.query(
        "select type, count(*)::int as n from public.stamp_events where card_id = $1 group by type order by type",
        [cardId],
      );
      expect(rows).toEqual([
        { type: "reward_redeemed", n: 1 },
        { type: "stamp", n: 6 },
      ]);
    });
  });

  it("rejects a card of another business and inactive staff", async () => {
    await asRole(db, "service_role", null, async (c) => {
      const cardId = await freshCard(c);
      const wrong = await c.query("select status from public.apply_stamp($1, $2, null, 0)", [otherBusinessId, cardId]);
      expect(wrong.rows[0].status).toBe("not_found");

      await c.query("update public.staff set is_active = false where id = $1", [DEMO.staff2Id]);
      const inactive = await c.query("select status from public.apply_stamp($1, $2, $3, 0)", [
        DEMO.businessId,
        cardId,
        DEMO.staff2Id,
      ]);
      expect(inactive.rows[0].status).toBe("staff_inactive");
    });
  });
});

describe("analytics RPCs", () => {
  it("return aggregates for the owner and refuse other owners", async () => {
    await asRole(db, "authenticated", DEMO.ownerId, async (c) => {
      const daily = await c.query(
        "select * from public.analytics_daily($1, current_date - 59, current_date)",
        [DEMO.businessId],
      );
      expect(daily.rows).toHaveLength(60);
      const total = daily.rows.reduce((sum, r) => sum + r.stamps, 0);
      expect(total).toBeGreaterThan(150);

      const heat = await c.query("select * from public.analytics_heatmap($1, current_date - 59, current_date)", [
        DEMO.businessId,
      ]);
      expect(heat.rows.every((r) => r.dow >= 1 && r.dow <= 7 && r.hour >= 0 && r.hour <= 23)).toBe(true);

      const cards = await c.query("select * from public.analytics_card_stats($1)", [DEMO.businessId]);
      expect(cards.rows.length).toBeGreaterThanOrEqual(40);

      const staff = await c.query("select * from public.analytics_staff($1, current_date - 59, current_date)", [
        DEMO.businessId,
      ]);
      expect(staff.rows.length).toBeGreaterThanOrEqual(2);
    });

    await expect(
      asRole(db, "authenticated", OTHER_OWNER, (c) =>
        c.query("select * from public.analytics_daily($1, current_date - 6, current_date)", [DEMO.businessId]),
      ),
    ).rejects.toThrow(/forbidden/);
  });
});
