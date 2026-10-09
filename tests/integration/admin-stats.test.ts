/**
 * supabase/migrations/*_admin_stats.sql: numbers for the service admin
 * dashboard across all businesses — correct for the seeded demo business, and
 * callable by the service role only (owners must never see other businesses).
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect, DEMO } from "./db";

let db: Client;

beforeAll(async () => {
  db = await connect();
});

afterAll(async () => {
  await db.end();
});

const STATS = "select * from public.admin_business_stats($1, $2, $3, $4)";
const GROWTH = "select * from public.admin_weekly_growth($1, $2)";

describe("admin_business_stats", () => {
  it("matches the demo business' own cards and stamps", async () => {
    const from = new Date(Date.now() - 365 * 86_400_000);
    const to = new Date(Date.now() + 86_400_000);
    const rows = await asRole(db, "service_role", null, async (c) =>
      (await c.query(STATS, [from, to, new Date(0), from])).rows,
    );
    const demo = rows.find((r) => r.business_id === DEMO.businessId);
    expect(demo).toBeDefined();

    const truth = await db.query(
      `select
         (select count(*)::int from public.cards where business_id = $1) as cards,
         (select count(*)::int from public.stamp_events where business_id = $1 and type = 'stamp') as stamps,
         (select max(created_at) from public.stamp_events where business_id = $1 and type = 'stamp') as last_at,
         (select email from auth.users u join public.businesses b on b.owner_id = u.id where b.id = $1) as email`,
      [DEMO.businessId],
    );
    expect(demo).toMatchObject({
      owner_email: truth.rows[0].email,
      cards_total: truth.rows[0].cards,
      cards_new: truth.rows[0].cards,
      cards_new_prev: 0,
      stamps: truth.rows[0].stamps,
      stamps_prev: 0,
    });
    expect(demo!.last_stamp_at?.getTime()).toBe(truth.rows[0].last_at?.getTime());
  });
});

describe("admin_weekly_growth", () => {
  it("returns one row per week, 13 weeks for a 12-week span", async () => {
    const to = new Date();
    const from = new Date(to.getTime() - 12 * 7 * 86_400_000);
    const rows = await asRole(db, "service_role", null, async (c) => (await c.query(GROWTH, [from, to])).rows);
    expect(rows).toHaveLength(13);
    for (const row of rows) {
      expect(row.new_businesses).toBeGreaterThanOrEqual(0);
      expect(row.new_cards).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("only the service role may read admin stats", () => {
  for (const role of ["anon", "authenticated"] as const) {
    it(`${role} is denied`, async () => {
      const now = new Date();
      await expect(
        asRole(db, role, DEMO.ownerId, (c) => c.query(STATS, [now, now, now, now])),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(asRole(db, role, DEMO.ownerId, (c) => c.query(GROWTH, [now, now]))).rejects.toMatchObject({
        code: "42501",
      });
    });
  }
});
