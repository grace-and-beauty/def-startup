/**
 * supabase/migrations/*_login_rate_limit.sql: hit_login_rate_limit counts
 * owner sign-in code checks; the limit holds under parallel requests and only
 * the service role may call it or read its table.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect } from "./db";

const SOMEONE = "00000000-0000-4000-8000-0000000000f1";

let db: Client;

beforeAll(async () => {
  db = await connect();
});

afterAll(async () => {
  await db.end();
});

/** One call as service_role on its own connection + transaction (like PostgREST). */
async function hit(key: string, max = 5, windowSeconds = 900): Promise<boolean> {
  const client = await connect();
  try {
    await client.query("begin");
    await client.query("set local role service_role");
    const { rows } = await client.query<{ allowed: boolean }>(
      "select public.hit_login_rate_limit('login_code_email', $1, $2, $3) as allowed",
      [key, max, windowSeconds],
    );
    await client.query("commit");
    return rows[0]!.allowed;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

describe("hit_login_rate_limit", () => {
  it("allows exactly 5 checks per window under parallel load", async () => {
    const key = "a".repeat(64);
    const results = await Promise.all(Array.from({ length: 9 }, () => hit(key)));
    expect(results.filter(Boolean)).toHaveLength(5);
    // Another email has its own counter.
    expect(await hit("b".repeat(64))).toBe(true);
  });

  it("forgets checks older than the window", async () => {
    const key = "c".repeat(64);
    await db.query(
      `insert into public.login_rate_limit_events (scope, key_hash, created_at)
       select 'login_code_email', $1, now() - interval '16 minutes' from generate_series(1, 5)`,
      [key],
    );
    expect(await hit(key)).toBe(true);
    const { rows } = await db.query(
      "select count(*)::int as n from public.login_rate_limit_events where key_hash = $1",
      [key],
    );
    expect(rows[0].n).toBe(1);
  });

  for (const role of ["anon", "authenticated"] as const) {
    it(`${role} is denied`, async () => {
      await expect(
        asRole(db, role, SOMEONE, (c) =>
          c.query("select public.hit_login_rate_limit('login_code_email', repeat('d', 64), 5, 900)"),
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await expect(
        asRole(db, role, SOMEONE, (c) => c.query("select * from public.login_rate_limit_events")),
      ).rejects.toMatchObject({ code: "42501" });
    });
  }
});
