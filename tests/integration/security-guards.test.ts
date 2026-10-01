/**
 * supabase/migrations/*_security_guards.sql: begin_staff_login, hit_rate_limit
 * and issue_card — limits hold under parallel requests, and only the service
 * role may call them. Also checks that domain/stamps.ts and the apply_stamp /
 * redeem_reward RPCs implement the same rules.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyStamp, cardStateFromRow, redeemReward, type StampCardState } from "@/lib/domain/stamps";

import { asRole, connect } from "./db";

const OWNER = "00000000-0000-4000-8000-0000000000e1";
const BUSINESS = "00000000-0000-4000-8000-0000000000e2";
const OTHER_BUSINESS = "00000000-0000-4000-8000-0000000000e3";
const STAFF = "00000000-0000-4000-8000-0000000000e4";
const PIN_HASH = `$2b$10$${"a".repeat(53)}`;

let db: Client;

/** One statement as service_role on its own connection + transaction (like PostgREST). */
async function asService<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = await connect();
  try {
    await client.query("begin");
    await client.query("set local role service_role");
    const { rows } = await client.query(sql, params);
    await client.query("commit");
    return rows as T[];
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

let tokenSeq = 0;
const token = () => `GuardTest${String(++tokenSeq).padStart(13, "0")}`;

beforeAll(async () => {
  db = await connect();
  await db.query("insert into auth.users (id, email) values ($1, 'guards@example.com') on conflict do nothing", [OWNER]);
  for (const [id, slug] of [
    [BUSINESS, "guards-test"],
    [OTHER_BUSINESS, "guards-test-2"],
  ]) {
    await db.query(
      `insert into public.businesses (id, owner_id, name, slug, niche_slug, onboarding_done)
       values ($1, $2, 'Guards', $3, 'avtomyika', true)`,
      [id, OWNER, slug],
    );
    await db.query(
      `insert into public.programs (business_id, stamps_required, reward_text) values ($1, 3, 'Подарунок')`,
      [id],
    );
  }
  await db.query(`insert into public.staff (id, business_id, name, pin_hash) values ($1, $2, 'Загальний', $3)`, [
    STAFF,
    BUSINESS,
    PIN_HASH,
  ]);
});

afterAll(async () => {
  await db.query("delete from public.businesses where owner_id = $1", [OWNER]);
  await db.query("delete from auth.users where id = $1", [OWNER]);
  await db.end();
});

describe("begin_staff_login", () => {
  const begin = (ip: string, maxBusiness = 30) =>
    asService<{ status: string; attempt_id: string | null; failures: number }>(
      "select * from public.begin_staff_login($1, $2, 15, 5, $3)",
      [BUSINESS, ip, maxBusiness],
    ).then((rows) => rows[0]);

  it("locks an IP after 5 failures, even when the guesses arrive in parallel", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, () => begin("ip-parallel")));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(5);
    expect(results.filter((r) => r.status === "locked")).toHaveLength(7);
    // Another IP is not affected.
    expect((await begin("ip-other")).status).toBe("ok");
  });

  it("a successful attempt does not count as a failure", async () => {
    const first = await begin("ip-success");
    expect(first).toMatchObject({ status: "ok", failures: 0 });
    await db.query("update public.staff_login_attempts set success = true where id = $1", [first.attempt_id]);
    expect(await begin("ip-success")).toMatchObject({ status: "ok", failures: 0 });
  });

  it("caps failures per business across IPs", async () => {
    await db.query("delete from public.staff_login_attempts where business_id = $1", [BUSINESS]);
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => begin(`ip-rotating-${i}`, 4)));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(4);
    expect(results.filter((r) => r.status === "locked_business")).toHaveLength(2);
  });

  it("ignores failures older than the window", async () => {
    await db.query("delete from public.staff_login_attempts where business_id = $1", [BUSINESS]);
    await db.query(
      `insert into public.staff_login_attempts (business_id, ip_hash, success, created_at)
       select $1, 'ip-old', false, now() - interval '16 minutes' from generate_series(1, 5)`,
      [BUSINESS],
    );
    expect((await begin("ip-old")).status).toBe("ok");
  });
});

describe("hit_rate_limit", () => {
  const hit = (key: string, business = BUSINESS) =>
    asService<{ allowed: boolean }>("select public.hit_rate_limit('join', $1, $2, 10, 60) as allowed", [
      business,
      key,
    ]).then((rows) => rows[0].allowed);

  it("allows exactly 10 hits per window under parallel load", async () => {
    const key = "k".repeat(64);
    const results = await Promise.all(Array.from({ length: 15 }, () => hit(key)));
    expect(results.filter(Boolean)).toHaveLength(10);
    // Same key on another business has its own counter.
    expect(await hit(key, OTHER_BUSINESS)).toBe(true);
  });

  it("forgets hits older than the window", async () => {
    const key = "o".repeat(64);
    await db.query(
      `insert into public.rate_limit_events (scope, business_id, key_hash, created_at)
       select 'join', $1, $2, now() - interval '61 seconds' from generate_series(1, 10)`,
      [BUSINESS, key],
    );
    expect(await hit(key)).toBe(true);
    const { rows } = await db.query(
      "select count(*)::int as n from public.rate_limit_events where business_id = $1 and key_hash = $2",
      [BUSINESS, key],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("issue_card", () => {
  const issue = (max: number | null, qr = token(), business = BUSINESS) =>
    asService<{ status: string; card_id: string | null }>(
      "select * from public.issue_card($1, $2, $3, $4, $5)",
      [business, " Олена ", "", qr, max],
    ).then((rows) => rows[0]);

  const customers = async () =>
    (await db.query("select count(*)::int as n from public.customers where business_id = $1", [BUSINESS])).rows[0]
      .n as number;

  it("creates customer + card and normalizes empty fields", async () => {
    const qr = token();
    const result = await issue(null, qr);
    expect(result.status).toBe("ok");
    const { rows } = await db.query(
      `select c.qr_token, c.business_id, c.stamps_count, cu.name, cu.phone
         from public.cards c join public.customers cu on cu.id = c.customer_id where c.id = $1`,
      [result.card_id],
    );
    expect(rows[0]).toEqual({ qr_token: qr, business_id: BUSINESS, stamps_count: 0, name: "Олена", phone: null });
  });

  it("never exceeds the plan limit under parallel joins", async () => {
    const before = await customers();
    const results = await Promise.all(Array.from({ length: 8 }, () => issue(before + 3)));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(3);
    expect(results.filter((r) => r.status === "limit_reached")).toHaveLength(5);
    expect(await customers()).toBe(before + 3);
  });

  it("a duplicate token fails without leaving an orphan customer", async () => {
    const qr = token();
    await issue(null, qr);
    const before = await customers();
    await expect(issue(null, qr)).rejects.toMatchObject({ code: "23505" });
    expect(await customers()).toBe(before);
  });

  it("returns not_found for a business without a program", async () => {
    await db.query("delete from public.programs where business_id = $1", [OTHER_BUSINESS]);
    expect((await issue(null, token(), OTHER_BUSINESS)).status).toBe("not_found");
  });
});

describe("only the service role may call the guards", () => {
  for (const role of ["anon", "authenticated"] as const) {
    it(`${role} is denied`, async () => {
      for (const sql of [
        "select public.hit_rate_limit('join', $1, 'x'::text || repeat('y', 20), 10, 60)",
        "select * from public.begin_staff_login($1, 'ip', 15, 5, 30)",
        "select * from public.issue_card($1, null, null, 'DeniedToken000000001', null)",
      ]) {
        await expect(asRole(db, role, OWNER, (c) => c.query(sql, [BUSINESS]))).rejects.toMatchObject({
          code: "42501",
        });
      }
      await expect(
        asRole(db, role, OWNER, (c) => c.query("select * from public.rate_limit_events")),
      ).rejects.toMatchObject({ code: "42501" });
    });
  }
});

describe("domain/stamps.ts ↔ RPC parity", () => {
  async function readCard(cardId: string): Promise<StampCardState> {
    const { rows } = await db.query("select * from public.cards where id = $1", [cardId]);
    return cardStateFromRow(rows[0]);
  }

  const stampRpc = (cardId: string, cooldown: number) =>
    asService<{ status: string; rewards_earned: number; retry_after: Date | null; last_visit_at: Date }>(
      "select * from public.apply_stamp($1, $2, $3, $4)",
      [BUSINESS, cardId, STAFF, cooldown],
    ).then((rows) => rows[0]);

  const redeemRpc = (cardId: string) =>
    asService<{ status: string }>("select * from public.redeem_reward($1, $2, $3)", [BUSINESS, cardId, STAFF]).then(
      (rows) => rows[0],
    );

  it("stamps, rollover and redemption produce the same card state", async () => {
    const { card_id: cardId } = (
      await asService<{ card_id: string }>("select * from public.issue_card($1, null, null, $2, null)", [
        BUSINESS,
        token(),
      ])
    )[0];

    for (let i = 0; i < 7; i++) {
      const before = await readCard(cardId);
      const rpc = await stampRpc(cardId, 0);
      const expected = applyStamp(before, { stampsRequired: 3 }, new Date(rpc.last_visit_at), 0);
      expect(rpc.status).toBe("ok");
      expect(expected.ok).toBe(true);
      if (!expected.ok) return;
      expect(rpc.rewards_earned).toBe(expected.rewardsEarned);
      expect(await readCard(cardId)).toEqual(expected.card);
    }
    // 7 stamps with 3 required → 2 rewards, 1 stamp left.
    expect(await readCard(cardId)).toMatchObject({ stampsCount: 1, rewardsAvailable: 2, totalVisits: 7 });

    for (let i = 0; i < 3; i++) {
      const before = await readCard(cardId);
      const expected = redeemReward(before);
      const rpc = await redeemRpc(cardId);
      expect(rpc.status).toBe(expected.ok ? "ok" : expected.reason);
      expect(await readCard(cardId)).toEqual(expected.ok ? expected.card : before);
    }
    expect(await readCard(cardId)).toMatchObject({ rewardsAvailable: 0, rewardsRedeemed: 2 });
  });

  it("cooldown: both refuse a second stamp and agree on retry time", async () => {
    const { card_id: cardId } = (
      await asService<{ card_id: string }>("select * from public.issue_card($1, null, null, $2, null)", [
        BUSINESS,
        token(),
      ])
    )[0];
    expect((await stampRpc(cardId, 10)).status).toBe("ok");
    const state = await readCard(cardId);
    const rpc = await stampRpc(cardId, 10);
    const domain = applyStamp(state, { stampsRequired: 3 }, new Date(), 10);
    expect(rpc.status).toBe("cooldown");
    expect(domain.ok).toBe(false);
    if (domain.ok) return;
    expect(new Date(rpc.retry_after!).getTime()).toBe(domain.retryAfter.getTime());
  });

  it("parallel stamps on one card never double-stamp within the cooldown", async () => {
    const { card_id: cardId } = (
      await asService<{ card_id: string }>("select * from public.issue_card($1, null, null, $2, null)", [
        BUSINESS,
        token(),
      ])
    )[0];
    const results = await Promise.all(Array.from({ length: 6 }, () => stampRpc(cardId, 10)));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(1);
    expect(await readCard(cardId)).toMatchObject({ stampsCount: 1, totalVisits: 1 });
  });

  it("a card of another business is not found by the RPC", async () => {
    const { rows } = await db.query(
      "select id from public.cards where business_id = $1 limit 1",
      ["00000000-0000-4000-8000-000000000101"],
    );
    const rpc = await stampRpc(rows[0].id, 0);
    expect(rpc.status).toBe("not_found");
  });
});
