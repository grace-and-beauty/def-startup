/**
 * supabase/migrations/*_messaging.sql: send_broadcast (quota under parallel
 * sends, service role only, at_risk recipients), record_reminder (idempotent,
 * service role only), message_recipients RLS, analytics_card_stats.second_visit_at.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect } from "./db";

const OWNER = "00000000-0000-4000-8000-0000000000f1";
const OTHER_OWNER = "00000000-0000-4000-8000-0000000000f2";
const BUSINESS = "00000000-0000-4000-8000-0000000000f3";
const OTHER_BUSINESS = "00000000-0000-4000-8000-0000000000f4";

let db: Client;
const cards: string[] = [];
let otherCard: string;
let noConsentCard: string;

async function asUser<T = Record<string, unknown>>(
  role: "authenticated" | "service_role",
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = await connect();
  try {
    return await asRole(client, role, userId, async (c) => (await c.query(sql, params)).rows as T[], { commit: true });
  } finally {
    await client.end();
  }
}

async function makeCard(
  business: string,
  n: number,
  lastVisitDaysAgo: number | null,
  consent = true,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `with cu as (
       insert into public.customers (business_id, name, marketing_consent_at, marketing_consent_source, marketing_consent_version)
       values ($1, $2, case when $5 then now() end, case when $5 then 'join_form' end, case when $5 then 'test-v1' end)
       returning id)
     insert into public.cards (business_id, program_id, customer_id, qr_token, last_visit_at)
     select $1, p.id, cu.id, $3, case when $4::int is null then null else now() - make_interval(days => $4::int) end
       from public.programs p, cu where p.business_id = $1
     returning id`,
    [business, `Client ${n}`, `MsgTestToken${String(n).padStart(10, "0")}`, lastVisitDaysAgo, consent],
  );
  return rows[0].id;
}

beforeAll(async () => {
  db = await connect();
  for (const [id, email] of [
    [OWNER, "msg-owner@example.com"],
    [OTHER_OWNER, "msg-other@example.com"],
  ]) {
    await db.query("insert into auth.users (id, email) values ($1, $2) on conflict do nothing", [id, email]);
  }
  for (const [id, owner, slug] of [
    [BUSINESS, OWNER, "msg-test"],
    [OTHER_BUSINESS, OTHER_OWNER, "msg-test-2"],
  ]) {
    await db.query(
      `insert into public.businesses (id, owner_id, name, slug, niche_slug, onboarding_done)
       values ($1, $2, 'Msg', $3, 'avtomyika', true)`,
      [id, owner, slug],
    );
    await db.query(`insert into public.programs (business_id, stamps_required, reward_text) values ($1, 6, 'Подарунок')`, [id]);
  }
  cards.push(await makeCard(BUSINESS, 1, 30));
  cards.push(await makeCard(BUSINESS, 2, 2));
  cards.push(await makeCard(BUSINESS, 3, null));
  otherCard = await makeCard(OTHER_BUSINESS, 4, 30);
  // Opted out: never a recipient, even when it would be due / at risk.
  noConsentCard = await makeCard(BUSINESS, 5, 30, false);
});

afterAll(async () => {
  await db.query("delete from public.businesses where id in ($1, $2)", [BUSINESS, OTHER_BUSINESS]);
  await db.query("delete from auth.users where id in ($1, $2)", [OWNER, OTHER_OWNER]);
  await db.end();
});

type BroadcastRow = { status: string; message_id: string | null; recipients_count: number; used: number };

// The dashboard calls send_broadcast with the service role after checking the owner.
const broadcast = (target: string, ids: string[] | null, max: number | null, business = BUSINESS) =>
  asUser<BroadcastRow>("service_role", null, "select * from public.send_broadcast($1, $2, $3, $4, $5)", [
    business,
    target,
    "Тестова розсилка",
    ids,
    max,
  ]).then((rows) => rows[0]);

describe("send_broadcast", () => {
  it("parallel sends never exceed the monthly quota", async () => {
    const results = await Promise.all(Array.from({ length: 6 }, () => broadcast("all", null, 2)));
    expect(results.filter((r) => r.status === "ok")).toHaveLength(2);
    expect(results.filter((r) => r.status === "quota_exhausted")).toHaveLength(4);
    // 3 opted-in cards; the opted-out one is not counted.
    expect(results.find((r) => r.status === "ok")?.recipients_count).toBe(3);
    // Unlimited plan (null) still works.
    expect((await broadcast("all", null, null)).status).toBe("ok");
  });

  it("at_risk stores only the business's own cards as recipients", async () => {
    const result = await broadcast("at_risk", [cards[0], otherCard, cards[0]], null);
    expect(result).toMatchObject({ status: "ok", recipients_count: 1 });
    const { rows } = await db.query("select card_id from public.message_recipients where message_id = $1", [result.message_id]);
    expect(rows).toEqual([{ card_id: cards[0] }]);
    expect((await broadcast("at_risk", [otherCard], null)).status).toBe("no_recipients");
    expect((await broadcast("at_risk", [noConsentCard], null)).status).toBe("no_recipients");
  });

  it("a broadcast to all lists its recipients — only customers who opted in", async () => {
    const result = await broadcast("all", null, null);
    const { rows } = await db.query<{ card_id: string }>(
      "select card_id from public.message_recipients where message_id = $1",
      [result.message_id],
    );
    expect(rows.map((r) => r.card_id).sort()).toEqual([...cards].sort());
  });

  it("owners can't call it directly — the quota would be theirs to choose", async () => {
    const direct = (userId: string) =>
      asUser("authenticated", userId, "select * from public.send_broadcast($1, 'all', 'x', null, null)", [BUSINESS]);
    await expect(direct(OWNER)).rejects.toThrow(/permission denied/);
    await expect(direct(OTHER_OWNER)).rejects.toThrow(/permission denied/);
  });

  it("owners can't write messages or recipients around the quota", async () => {
    await expect(
      asUser(
        "authenticated",
        OWNER,
        "insert into public.messages (business_id, kind, target, text) values ($1, 'broadcast', 'all', 'x')",
        [BUSINESS],
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser("authenticated", OWNER, "delete from public.message_recipients where business_id = $1", [BUSINESS]),
    ).rejects.toThrow(/permission denied/);
  });

  it("owners read only their own message_recipients", async () => {
    const mine = await asUser("authenticated", OWNER, "select count(*)::int as n from public.message_recipients");
    const theirs = await asUser("authenticated", OTHER_OWNER, "select count(*)::int as n from public.message_recipients");
    expect((mine[0] as { n: number }).n).toBeGreaterThan(0);
    expect((theirs[0] as { n: number }).n).toBe(0);
  });
});

describe("record_reminder", () => {
  const remind = (ids: string[]) =>
    asUser<{ message_id: string; card_id: string }>(
      "service_role",
      null,
      "select * from public.record_reminder($1, 'Давно не бачились', $2)",
      [BUSINESS, ids],
    );

  it("reminds each due card once, skips cards without visits and of other businesses", async () => {
    const first = await remind([cards[0], cards[2], otherCard, noConsentCard]);
    expect(first.map((r) => r.card_id)).toEqual([cards[0]]);
    const { rows } = await db.query(
      "select kind, target, recipients_count from public.messages where id = $1",
      [first[0].message_id],
    );
    expect(rows[0]).toEqual({ kind: "reminder", target: "card", recipients_count: 1 });

    expect(await remind([cards[0]])).toEqual([]);

    // A new visit re-arms the reminder.
    await db.query("update public.cards set last_visit_at = now() where id = $1", [cards[0]]);
    expect((await remind([cards[0]])).map((r) => r.card_id)).toEqual([cards[0]]);
  });

  it("is not callable by owners", async () => {
    await expect(
      asUser("authenticated", OWNER, "select * from public.record_reminder($1, 'x', $2)", [BUSINESS, [cards[1]]]),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("analytics_card_stats.second_visit_at", () => {
  it("is the time of the second stamp", async () => {
    await db.query(
      `insert into public.stamp_events (business_id, card_id, type, created_at) values
         ($1, $2, 'stamp', now() - interval '20 days'),
         ($1, $2, 'stamp', now() - interval '10 days'),
         ($1, $2, 'reward_redeemed', now() - interval '9 days'),
         ($1, $2, 'stamp', now() - interval '1 day')`,
      [BUSINESS, cards[1]],
    );
    const rows = await asUser<{ card_id: string; visits: number; first_visit_at: Date; second_visit_at: Date | null }>(
      "authenticated",
      OWNER,
      "select card_id, visits, first_visit_at, second_visit_at from public.analytics_card_stats($1)",
      [BUSINESS],
    );
    const row = rows.find((r) => r.card_id === cards[1]);
    expect(row?.visits).toBe(3);
    const gapDays = (row!.second_visit_at!.getTime() - row!.first_visit_at.getTime()) / 86_400_000;
    expect(Math.round(gapDays)).toBe(10);
    expect(rows.find((r) => r.card_id === cards[2])?.second_visit_at).toBeNull();
  });
});
