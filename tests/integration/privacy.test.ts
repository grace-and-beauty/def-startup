/**
 * supabase/migrations/*_consent_audit_privacy.sql: marketing consent on the
 * join form and the web card, the consent log, anonymization (personal data
 * gone, visit journal kept, old card link dead), audit log, support helpers.
 */
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { asRole, connect } from "./db";

const OWNER = "00000000-0000-4000-8000-0000000000c1";
const OTHER_OWNER = "00000000-0000-4000-8000-0000000000c2";
const BUSINESS = "00000000-0000-4000-8000-0000000000c3";
const VERSION = "test-2026-10-05";

let db: Client;
let tokenSeq = 0;
const token = () => `PrivacyTest${String(++tokenSeq).padStart(11, "0")}`;

async function as<T = Record<string, unknown>>(
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

async function issue(name: string, consent: boolean): Promise<{ cardId: string; qrToken: string }> {
  const qrToken = token();
  const [row] = await as<{ status: string; card_id: string }>(
    "service_role",
    null,
    "select * from public.issue_card($1, $2, '+380501112233', $3, null, $4, $5)",
    [BUSINESS, name, qrToken, consent, VERSION],
  );
  expect(row.status).toBe("ok");
  return { cardId: row.card_id, qrToken };
}

async function customerOf(cardId: string) {
  const { rows } = await db.query(
    `select cu.* from public.customers cu join public.cards c on c.customer_id = cu.id where c.id = $1`,
    [cardId],
  );
  return rows[0];
}

beforeAll(async () => {
  db = await connect();
  for (const [id, email] of [
    [OWNER, "privacy-owner@example.com"],
    [OTHER_OWNER, "privacy-other@example.com"],
  ]) {
    await db.query("insert into auth.users (id, email) values ($1, $2) on conflict do nothing", [id, email]);
  }
  await db.query(
    `insert into public.businesses (id, owner_id, name, slug, niche_slug, onboarding_done)
     values ($1, $2, 'Privacy', 'privacy-test', 'barbershop', true)`,
    [BUSINESS, OWNER],
  );
  await db.query(`insert into public.programs (business_id, stamps_required, reward_text) values ($1, 6, 'Стрижка')`, [
    BUSINESS,
  ]);
});

afterAll(async () => {
  await db.query("delete from public.businesses where id = $1", [BUSINESS]);
  await db.query("delete from public.audit_log where business_id = $1", [BUSINESS]);
  await db.query("delete from auth.users where id in ($1, $2)", [OWNER, OTHER_OWNER]);
  await db.end();
});

describe("marketing consent", () => {
  it("is off unless the customer ticks it on the join form", async () => {
    const without = await issue("Без згоди", false);
    expect((await customerOf(without.cardId)).marketing_consent_at).toBeNull();

    const withConsent = await issue("Зі згодою", true);
    const customer = await customerOf(withConsent.cardId);
    expect(customer.marketing_consent_at).not.toBeNull();
    expect(customer).toMatchObject({ marketing_consent_source: "join_form", marketing_consent_version: VERSION });
    const { rows } = await db.query("select granted, source, consent_version from public.customer_consent_events where customer_id = $1", [
      customer.id,
    ]);
    expect(rows).toEqual([{ granted: true, source: "join_form", consent_version: VERSION }]);
  });

  it("can be withdrawn and given again on the web card, each change logged", async () => {
    const card = await issue("Передумав", true);
    const set = async (granted: boolean) =>
      (
        await as<{ set_marketing_consent: boolean | null }>(
          "service_role",
          null,
          "select public.set_marketing_consent($1, $2, $3)",
          [card.qrToken, granted, VERSION],
        )
      )[0].set_marketing_consent;

    expect(await set(false)).toBe(false);
    expect((await customerOf(card.cardId)).marketing_consent_at).toBeNull();
    expect(await set(false)).toBe(false); // no change → no new event
    expect(await set(true)).toBe(true);
    expect((await customerOf(card.cardId)).marketing_consent_source).toBe("web_card");

    const customer = await customerOf(card.cardId);
    const { rows } = await db.query(
      "select granted, source from public.customer_consent_events where customer_id = $1 order by id",
      [customer.id],
    );
    expect(rows).toEqual([
      { granted: true, source: "join_form" },
      { granted: false, source: "web_card" },
      { granted: true, source: "web_card" },
    ]);
    const unknown = await as("service_role", null, "select public.set_marketing_consent('NoSuchToken0000000000', true, 'v')");
    expect(unknown[0].set_marketing_consent).toBeNull();
  });

  it("owners can't set it themselves — only the customer's own choice counts", async () => {
    const card = await issue("Чужа згода", false);
    const customer = await customerOf(card.cardId);
    await expect(
      as("authenticated", OWNER, "update public.customers set marketing_consent_at = now() where id = $1", [customer.id]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(
        "authenticated",
        OWNER,
        "insert into public.customer_consent_events (business_id, customer_id, granted, source) values ($1, $2, true, 'owner')",
        [BUSINESS, customer.id],
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("anonymization", () => {
  it("removes personal data, keeps the visit journal and kills the old card link", async () => {
    const card = await issue("Видаліть мене", true);
    await as("service_role", null, "select * from public.apply_stamp($1, $2, null, 0)", [BUSINESS, card.cardId]);
    const customer = await customerOf(card.cardId);

    const [result] = await as("authenticated", OWNER, "select public.anonymize_customer($1) as ok", [customer.id]);
    expect(result.ok).toBe(true);

    const after = await customerOf(card.cardId);
    expect(after).toMatchObject({ name: null, phone: null, marketing_consent_at: null });
    expect(after.anonymized_at).not.toBeNull();

    const { rows: cardRows } = await db.query("select qr_token from public.cards where id = $1", [card.cardId]);
    expect(cardRows[0].qr_token).not.toBe(card.qrToken);
    const { rows: events } = await db.query("select type from public.stamp_events where card_id = $1", [card.cardId]);
    expect(events).toEqual([{ type: "stamp" }]);

    const { rows: audit } = await db.query(
      "select actor_type, actor, action, target_id from public.audit_log where business_id = $1 and action = 'customer_anonymized'",
      [BUSINESS],
    );
    expect(audit).toContainEqual({ actor_type: "owner", actor: OWNER, action: "customer_anonymized", target_id: customer.id });

    // Already anonymized: nothing more to do.
    const [again] = await as("authenticated", OWNER, "select public.anonymize_customer($1) as ok", [customer.id]);
    expect(again.ok).toBe(false);
  });

  it("another owner can't anonymize someone else's customer", async () => {
    const card = await issue("Не чіпати", false);
    const customer = await customerOf(card.cardId);
    await expect(
      as("authenticated", OTHER_OWNER, "select public.anonymize_customer($1)", [customer.id]),
    ).rejects.toThrow(/not allowed/);
    expect((await customerOf(card.cardId)).name).toBe("Не чіпати");
  });
});

describe("audit log and support", () => {
  it("owners read their audit records but can't write them", async () => {
    await expect(
      as(
        "authenticated",
        OWNER,
        "insert into public.audit_log (business_id, actor_type, actor, action) values ($1, 'support', 'x', 'fake')",
        [BUSINESS],
      ),
    ).rejects.toThrow(/permission denied/);
    const mine = await as("authenticated", OWNER, "select count(*)::int as n from public.audit_log where business_id = $1", [BUSINESS]);
    const theirs = await as("authenticated", OTHER_OWNER, "select count(*)::int as n from public.audit_log where business_id = $1", [
      BUSINESS,
    ]);
    expect((mine[0] as { n: number }).n).toBeGreaterThan(0);
    expect((theirs[0] as { n: number }).n).toBe(0);
  });

  it("owner exports are logged; unknown actions refused", async () => {
    await as("authenticated", OWNER, "select public.log_owner_action($1, 'export_customers', '{\"rows\": 3}')", [BUSINESS]);
    await expect(as("authenticated", OWNER, "select public.log_owner_action($1, 'drop_everything')", [BUSINESS])).rejects.toThrow(
      /unknown owner action/,
    );
    await expect(
      as("authenticated", OTHER_OWNER, "select public.log_owner_action($1, 'export_customers')", [BUSINESS]),
    ).rejects.toThrow(/not allowed/);
  });

  it("support actions need a reason and are logged; owners can't call them", async () => {
    await expect(
      as("service_role", null, "select public.support_log($1, 'artem', 'looked_up_business', '')", [BUSINESS]),
    ).rejects.toThrow(/reason/);
    await as("service_role", null, "select public.support_log($1, 'artem', 'looked_up_business', 'Тікет 12: не ставиться штамп')", [
      BUSINESS,
    ]);

    const card = await issue("Запит через підтримку", false);
    const customer = await customerOf(card.cardId);
    await expect(
      as("authenticated", OWNER, "select public.support_anonymize_customer($1, 'x', 'чужий виклик')", [customer.id]),
    ).rejects.toThrow(/permission denied/);
    const [ok] = await as(
      "service_role",
      null,
      "select public.support_anonymize_customer($1, 'artem', 'Лист клієнта від 05.10') as ok",
      [customer.id],
    );
    expect(ok.ok).toBe(true);
    const { rows } = await db.query(
      "select actor_type, actor, reason from public.audit_log where target_id = $1",
      [customer.id],
    );
    expect(rows).toEqual([{ actor_type: "support", actor: "artem", reason: "Лист клієнта від 05.10" }]);
  });
});

describe("support: undo a mistaken stamp", () => {
  const stamp = (cardId: string) =>
    as("service_role", null, "select * from public.apply_stamp($1, $2, null, 0)", [BUSINESS, cardId]);
  const undo = async (cardId: string) =>
    (
      await as<{ result: string }>(
        "service_role",
        null,
        "select public.support_undo_last_stamp($1, 'artem', 'Тікет 7: подвійний штамп') as result",
        [cardId],
      )
    )[0].result;
  const counters = async (cardId: string) =>
    (
      await db.query(
        "select stamps_count, rewards_available, total_visits, (last_visit_at is null) as no_visit from public.cards where id = $1",
        [cardId],
      )
    ).rows[0];

  it("takes back the latest stamp, recomputes the counters and logs it", async () => {
    const card = await issue("Подвійний штамп", false);
    await stamp(card.cardId);
    await stamp(card.cardId);
    expect(await undo(card.cardId)).toBe("ok");
    expect(await counters(card.cardId)).toEqual({ stamps_count: 1, rewards_available: 0, total_visits: 1, no_visit: false });
    expect(await undo(card.cardId)).toBe("ok");
    expect(await counters(card.cardId)).toEqual({ stamps_count: 0, rewards_available: 0, total_visits: 0, no_visit: true });
    expect(await undo(card.cardId)).toBe("last_event_not_a_stamp");
    const { rows } = await db.query(
      "select count(*)::int as n from public.audit_log where target_id = $1 and action = 'stamp_undone'",
      [card.cardId],
    );
    expect(rows[0].n).toBe(2);
  });

  it("a stamp that completed the card takes the reward back; a handed-out reward is left to a human", async () => {
    const card = await issue("Повна картка", false);
    for (let i = 0; i < 6; i++) await stamp(card.cardId);
    expect(await counters(card.cardId)).toMatchObject({ stamps_count: 0, rewards_available: 1 });
    expect(await undo(card.cardId)).toBe("ok");
    expect(await counters(card.cardId)).toMatchObject({ stamps_count: 5, rewards_available: 0, total_visits: 5 });

    await stamp(card.cardId);
    await as("service_role", null, "select * from public.redeem_reward($1, $2, null)", [BUSINESS, card.cardId]);
    // The latest event is now the redemption: nothing to undo automatically.
    expect(await undo(card.cardId)).toBe("last_event_not_a_stamp");
  });

  it("owners can't call it", async () => {
    const card = await issue("Не для власника", false);
    await expect(
      as("authenticated", OWNER, "select public.support_undo_last_stamp($1, 'x', 'спроба власника')", [card.cardId]),
    ).rejects.toThrow(/permission denied/);
  });
});
