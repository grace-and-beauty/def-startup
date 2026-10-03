/**
 * supabase/migrations/*_owner_write_limits.sql: owners talk to the Data API
 * directly too, so the database itself must refuse what only the server may
 * set — the logo URL, plan add-ons, billing fields — while the wizard and the
 * settings keep working.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect } from "./db";

const OWNER = "00000000-0000-4000-8000-0000000000d1";
const BUSINESS = "00000000-0000-4000-8000-0000000000d2";

let db: Client;

async function asOwner(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  const client = await connect();
  try {
    return await asRole(client, "authenticated", OWNER, async (c) => (await c.query(sql, params)).rows, {
      commit: true,
    });
  } finally {
    await client.end();
  }
}

beforeAll(async () => {
  db = await connect();
  await db.query("insert into auth.users (id, email) values ($1, 'limits@example.com') on conflict do nothing", [OWNER]);
  await db.query(
    `insert into public.businesses (id, owner_id, name, slug, niche_slug, onboarding_done)
     values ($1, $2, 'Limits', 'limits-test', 'avtomyika', true)`,
    [BUSINESS, OWNER],
  );
});

afterAll(async () => {
  await db.query("delete from public.businesses where id = $1", [BUSINESS]);
  await db.query("delete from auth.users where id = $1", [OWNER]);
  await db.end();
});

describe("businesses: owner writes", () => {
  it("still lets the owner change what the settings page edits", async () => {
    await asOwner(
      "update public.businesses set name = 'Нова назва', bg_color = '#222222', avg_check = 300 where id = $1",
      [BUSINESS],
    );
    const { rows } = await db.query("select name, bg_color, avg_check from public.businesses where id = $1", [BUSINESS]);
    expect(rows[0]).toEqual({ name: "Нова назва", bg_color: "#222222", avg_check: 300 });
  });

  it("refuses a logo URL from the owner — only the server sets it after an upload", async () => {
    await expect(
      asOwner("update public.businesses set logo_url = 'https://evil.example/x.png' where id = $1", [BUSINESS]),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses plan add-ons and billing fields", async () => {
    await expect(
      asOwner(`update public.businesses set enabled_modules = '{"bonuses": true}' where id = $1`, [BUSINESS]),
    ).rejects.toThrow(/permission denied/);
    await expect(asOwner("update public.businesses set plan = 'plus' where id = $1", [BUSINESS])).rejects.toThrow(
      /permission denied/,
    );
  });

  it("refuses a logo URL in a directly inserted business", async () => {
    await expect(
      asOwner(
        `insert into public.businesses (owner_id, name, slug, niche_slug, logo_url)
         values ($1, 'Second', 'limits-test-2', 'avtomyika', 'https://evil.example/x.png')`,
        [OWNER],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
