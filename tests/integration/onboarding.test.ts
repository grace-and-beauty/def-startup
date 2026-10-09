/**
 * RPC onboard_business (supabase/migrations/*_rpc_onboarding.sql): one
 * transaction for business + program + default staff, as the signed-in owner.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect } from "./db";

const OWNER = "00000000-0000-4000-8000-0000000000d1";
// Shape of a bcrypt hash ($2b$10$ + 53 chars); the RPC only checks the format.
const PIN_HASH = `$2b$10$${"a".repeat(53)}`;

let db: Client;

const ARGS = (slug: string, pinHash = PIN_HASH) => [
  "Тестова автомийка",
  slug,
  "avtomyika",
  "#0f172a",
  "#ffffff",
  "#94a3b8",
  6,
  "6-та мийка безкоштовно",
  "",
  14,
  "Час помити авто!",
  "Загальний",
  pinHash,
];

const CALL = "select * from public.onboard_business($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)";

beforeAll(async () => {
  db = await connect();
  await db.query("insert into auth.users (id, email) values ($1, 'onboard@example.com') on conflict do nothing", [
    OWNER,
  ]);
});

afterAll(async () => {
  await db.query("delete from public.businesses where owner_id = $1", [OWNER]);
  await db.query("delete from auth.users where id = $1", [OWNER]);
  await db.end();
});

describe("onboard_business", () => {
  it("creates business, program and staff atomically with a forced trial", async () => {
    await asRole(db, "authenticated", OWNER, async (c) => {
      const { rows } = await c.query(CALL, ARGS("onboard-test"));
      expect(rows[0].status).toBe("ok");

      const business = await c.query(
        `select owner_id, plan, onboarding_done, trial_ends_at between now() + interval '29 days' and now() + interval '31 days' as trial30
         from public.businesses where id = $1`,
        [rows[0].business_id],
      );
      expect(business.rows[0]).toMatchObject({ owner_id: OWNER, plan: "trial", onboarding_done: true, trial30: true });

      const program = await c.query(
        "select stamps_required, terms_text, reminders_enabled, reminder_days from public.programs where business_id = $1",
        [rows[0].business_id],
      );
      expect(program.rows[0]).toEqual({ stamps_required: 6, terms_text: null, reminders_enabled: false, reminder_days: 14 });

      const staff = await c.query("select name, is_active from public.staff where business_id = $1", [rows[0].business_id]);
      expect(staff.rows).toEqual([{ name: "Загальний", is_active: true }]);

      // Second call: nothing changes.
      const again = await c.query(CALL, ARGS("onboard-test-2"));
      expect(again.rows[0]).toEqual({ business_id: rows[0].business_id, status: "already_done" });
    });
  });

  it("rejects a taken slug without leaving partial rows", async () => {
    await asRole(db, "authenticated", OWNER, async (c) => {
      await c.query("savepoint s");
      await expect(c.query(CALL, ARGS("avtomyika-demo"))).rejects.toMatchObject({ code: "23505" });
      await c.query("rollback to savepoint s");
      const { rows } = await c.query("select count(*)::int as n from public.businesses where owner_id = $1", [OWNER]);
      expect(rows[0].n).toBe(0);
    });
  });

  it("requires a signed-in user and a bcrypt hash", async () => {
    await expect(asRole(db, "authenticated", null, (c) => c.query(CALL, ARGS("onboard-anon")))).rejects.toMatchObject({
      code: "42501",
    });
    await expect(
      asRole(db, "authenticated", OWNER, (c) => c.query(CALL, ARGS("onboard-raw-pin", "1234"))),
    ).rejects.toMatchObject({ code: "22023" });
    await expect(asRole(db, "anon", null, (c) => c.query(CALL, ARGS("onboard-anon-2")))).rejects.toMatchObject({
      code: "42501",
    });
  });
});

describe("owner contacts (migration *_owner_contacts.sql)", () => {
  const OWNER2 = "00000000-0000-4000-8000-0000000000d2";
  const CALL15 =
    "select * from public.onboard_business($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)";

  beforeAll(async () => {
    await db.query("insert into auth.users (id, email) values ($1, 'contacts@example.com') on conflict do nothing", [
      OWNER2,
    ]);
  });

  afterAll(async () => {
    await db.query("delete from public.businesses where owner_id = $1", [OWNER2]);
    await db.query("delete from auth.users where id = $1", [OWNER2]);
  });

  it("the wizard overload stores phone and city in the same transaction", async () => {
    await asRole(db, "authenticated", OWNER2, async (c) => {
      const { rows } = await c.query(CALL15, [...ARGS("contacts-test"), "+380671234567", "  Рівне "]);
      expect(rows[0].status).toBe("ok");
      const business = await c.query("select contact_phone, city from public.businesses where id = $1", [
        rows[0].business_id,
      ]);
      expect(business.rows[0]).toEqual({ contact_phone: "+380671234567", city: "Рівне" });
    });
  });

  it("rejects a phone that is not +380 and 9 digits, leaving nothing behind", async () => {
    await asRole(db, "authenticated", OWNER2, async (c) => {
      await c.query("savepoint s");
      await expect(c.query(CALL15, [...ARGS("contacts-bad"), "0671234567", "Рівне"])).rejects.toMatchObject({
        code: "23514",
      });
      await c.query("rollback to savepoint s");
      const { rows } = await c.query("select count(*)::int as n from public.businesses where owner_id = $1", [OWNER2]);
      expect(rows[0].n).toBe(0);
    });
  });

  it("owners can fill in contacts later in settings", async () => {
    await asRole(db, "authenticated", OWNER2, async (c) => {
      const { rows } = await c.query(CALL, ARGS("contacts-later"));
      const id = rows[0].business_id;
      await c.query("update public.businesses set contact_phone = '+380501112233', city = 'Київ' where id = $1", [id]);
      const business = await c.query("select contact_phone, city from public.businesses where id = $1", [id]);
      expect(business.rows[0]).toEqual({ contact_phone: "+380501112233", city: "Київ" });
    });
  });
});
