/**
 * Pilot release check: the full life of a customer's consent to messages.
 *
 *   no consent → broadcast + reminder do not reach the card
 *   consent    → only messages created after it reach the card
 *   withdrawn  → no broadcast / reminder reaches the card any more
 *
 * "Reaches the card" is message_recipients: the web card shows only messages
 * listed there for it (getLatestMessageForCard), Google Wallet messages are
 * sent only to those cards. Every consent change and every delivery is in
 * audit_log, and nobody but the customer (via the server) can change consent.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect } from "./db";

const OWNER = "00000000-0000-4000-8000-0000000000a1";
const BUSINESS = "00000000-0000-4000-8000-0000000000a2";
const TOKEN = "LifecycleToken0000000001";
const OTHER_TOKEN = "LifecycleToken0000000002";
const VERSION = "test-2026-10-05";

let db: Client;
let cardId: string;
let customerId: string;

async function as<T = Record<string, unknown>>(
  role: "anon" | "authenticated" | "service_role",
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

const broadcast = async (text: string) =>
  (
    await as<{ status: string; message_id: string | null }>(
      "service_role",
      null,
      "select * from public.send_broadcast($1, 'all', $2, null, null)",
      [BUSINESS, text],
    )
  )[0];

/** Makes both cards due for a reminder, then runs it for both. */
const remind = async () => {
  await db.query(
    "update public.cards set last_visit_at = now() - interval '40 days', last_reminder_at = null where business_id = $1",
    [BUSINESS],
  );
  const cards = (await db.query("select id from public.cards where business_id = $1", [BUSINESS])).rows.map((r) => r.id);
  return as<{ message_id: string; card_id: string }>(
    "service_role",
    null,
    "select * from public.record_reminder($1, 'Давно не бачились', $2)",
    [BUSINESS, cards],
  );
};

/** What the web card would show: messages listed for this card, newest first. */
const messagesOfCard = async () =>
  (
    await db.query(
      `select m.text from public.message_recipients r join public.messages m on m.id = r.message_id
        where r.card_id = $1 order by r.created_at desc`,
      [cardId],
    )
  ).rows.map((r) => r.text);

const setConsent = (granted: boolean) =>
  as("service_role", null, "select public.set_marketing_consent($1, $2, $3)", [TOKEN, granted, VERSION]);

beforeAll(async () => {
  db = await connect();
  await db.query("insert into auth.users (id, email) values ($1, 'lifecycle@example.com') on conflict do nothing", [OWNER]);
  await db.query(
    `insert into public.businesses (id, owner_id, name, slug, niche_slug, onboarding_done)
     values ($1, $2, 'Lifecycle', 'lifecycle-test', 'barbershop', true)`,
    [BUSINESS, OWNER],
  );
  await db.query(`insert into public.programs (business_id, stamps_required, reward_text) values ($1, 6, 'Стрижка')`, [
    BUSINESS,
  ]);
  // The customer under test joins WITHOUT consent; a second one with consent,
  // so every broadcast has somebody to reach.
  const [card] = await as<{ card_id: string }>(
    "service_role",
    null,
    "select * from public.issue_card($1, 'Без згоди', null, $2, null, false, $3)",
    [BUSINESS, TOKEN, VERSION],
  );
  cardId = card.card_id;
  customerId = (await db.query("select customer_id from public.cards where id = $1", [cardId])).rows[0].customer_id;
  await as("service_role", null, "select * from public.issue_card($1, 'Зі згодою', null, $2, null, true, $3)", [
    BUSINESS,
    OTHER_TOKEN,
    VERSION,
  ]);
});

afterAll(async () => {
  await db.query("delete from public.businesses where id = $1", [BUSINESS]);
  await db.query("delete from public.audit_log where business_id = $1", [BUSINESS]);
  await db.query("delete from auth.users where id = $1", [OWNER]);
  await db.end();
});

describe("consent lifecycle", () => {
  it("1. without consent: neither a broadcast nor a reminder reaches the customer", async () => {
    expect((await broadcast("До згоди")).status).toBe("ok");
    const reminded = await remind();
    expect(reminded.map((r) => r.card_id)).not.toContain(cardId);
    expect(await messagesOfCard()).toEqual([]);
  });

  it("2. after consent: only messages created after it arrive", async () => {
    await setConsent(true);
    expect((await broadcast("Після згоди")).status).toBe("ok");
    const reminded = await remind();
    expect(reminded.map((r) => r.card_id)).toContain(cardId);
    expect(await messagesOfCard()).toEqual(["Давно не бачились", "Після згоди"]);
  });

  it("3. after withdrawal: no further broadcast or reminder", async () => {
    await setConsent(false);
    expect((await broadcast("Після відкликання")).status).toBe("ok");
    const reminded = await remind();
    expect(reminded.map((r) => r.card_id)).not.toContain(cardId);
    expect(await messagesOfCard()).toEqual(["Давно не бачились", "Після згоди"]);
  });

  it("4. consent changes and every delivery are in the audit log", async () => {
    const { rows: consent } = await db.query(
      "select action, actor_type from public.audit_log where target_id = $1 order by id",
      [customerId],
    );
    expect(consent).toEqual([
      { action: "consent_granted", actor_type: "customer" },
      { action: "consent_withdrawn", actor_type: "customer" },
    ]);

    const { rows: deliveries } = await db.query(
      `select action, details->>'recipients' as recipients, details->>'skipped_without_consent' as skipped
         from public.audit_log where business_id = $1 and action = 'broadcast_delivered' order by id`,
      [BUSINESS],
    );
    // Before consent and after withdrawal 1 of 2 cards is skipped; in between both are reached.
    expect(deliveries).toEqual([
      { action: "broadcast_delivered", recipients: "1", skipped: "1" },
      { action: "broadcast_delivered", recipients: "2", skipped: "0" },
      { action: "broadcast_delivered", recipients: "1", skipped: "1" },
    ]);
    const { rows: reminders } = await db.query(
      "select details->>'recipients' as recipients from public.audit_log where business_id = $1 and action = 'reminder_delivered' order by id",
      [BUSINESS],
    );
    expect(reminders.map((r) => r.recipients)).toEqual(["1", "2", "1"]);
  });

  it("5. cannot be bypassed: not from the browser (anon), not by the owner through the API", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      const user = role === "authenticated" ? OWNER : null;
      await expect(as(role, user, "select public.set_marketing_consent($1, true, 'x')", [TOKEN])).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        as(role, user, "update public.customers set marketing_consent_at = now() where id = $1", [customerId]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, user, "insert into public.message_recipients (message_id, card_id, business_id) select id, $1, $2 from public.messages limit 1", [
          cardId,
          BUSINESS,
        ]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, user, "select * from public.send_broadcast($1, 'all', 'x', null, null)", [BUSINESS]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, user, "select * from public.record_reminder($1, 'x', array[$2]::uuid[])", [BUSINESS, cardId]),
      ).rejects.toThrow(/permission denied/);
      await expect(
        as(role, user, "insert into public.audit_log (business_id, actor_type, actor, action) values ($1, 'customer', 'x', 'consent_granted')", [
          BUSINESS,
        ]),
      ).rejects.toThrow(/permission denied/);
    }
    const { rows } = await db.query("select marketing_consent_at from public.customers where id = $1", [customerId]);
    expect(rows[0].marketing_consent_at).toBeNull();
  });
});
