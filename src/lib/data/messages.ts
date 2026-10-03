import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type { Message, MessageKind, SendBroadcastResult, TablesInsert } from "./types";

export async function insertMessage(
  db: Db,
  input: Omit<TablesInsert<"messages">, "id" | "created_at">,
): Promise<Message> {
  return unwrapRequired(
    "insertMessage",
    await db.from("messages").insert(input).select("*").single(),
  );
}

export async function listMessages(db: Db, businessId: string, limit = 50): Promise<Message[]> {
  return (
    unwrap(
      "listMessages",
      await db
        .from("messages")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ) ?? []
  );
}

/** Broadcast quota: count since the start of the month in the business timezone (computed by the caller). */
export async function countMessagesSince(
  db: Db,
  businessId: string,
  kind: MessageKind,
  since: Date,
): Promise<number> {
  const { count, error } = await db
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("kind", kind)
    .gte("created_at", since.toISOString());
  unwrap("countMessagesSince", { data: null, error });
  return count ?? 0;
}

/** Latest message to everyone — shown on the web card. */
export async function getLatestBroadcast(db: Db, businessId: string): Promise<Message | null> {
  return unwrap(
    "getLatestBroadcast",
    await db
      .from("messages")
      .select("*")
      .eq("business_id", businessId)
      .eq("kind", "broadcast")
      .eq("target", "all")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
}

/**
 * Broadcast with the monthly quota checked under a lock (RPC send_broadcast).
 * Service role only: the quota is the caller's to set, so owners can't call
 * the RPC themselves — the Server Action checks the owner, then calls this.
 * maxPerMonth: plan limit, Infinity / null = unlimited. cardIds: recipients of
 * an at_risk broadcast (ignored for "all").
 */
export async function sendBroadcastRpc(
  db: Db,
  input: {
    businessId: string;
    target: "all" | "at_risk";
    text: string;
    cardIds: string[] | null;
    maxPerMonth: number | null;
  },
): Promise<SendBroadcastResult> {
  const max = input.maxPerMonth;
  const rows = unwrapRequired(
    "sendBroadcast",
    await db.rpc("send_broadcast", {
      p_business_id: input.businessId,
      p_target: input.target,
      p_text: input.text,
      p_card_ids: input.target === "at_risk" ? (input.cardIds ?? []) : null,
      p_max_per_month: max !== null && Number.isFinite(max) ? Math.max(0, Math.floor(max)) : null,
    }),
  );
  const [row] = rows;
  if (!row) throw new Error("sendBroadcast: empty result");
  return row;
}

/**
 * Service role (cron): marks the due cards reminded and stores the reminder
 * (RPC record_reminder). Returns the ids actually reminded — cards reminded
 * meanwhile by an overlapping run are skipped.
 */
export async function recordReminder(
  admin: Db,
  input: { businessId: string; text: string; cardIds: string[] },
): Promise<{ messageId: string | null; cardIds: string[] }> {
  if (input.cardIds.length === 0) return { messageId: null, cardIds: [] };
  const rows =
    unwrap(
      "recordReminder",
      await admin.rpc("record_reminder", {
        p_business_id: input.businessId,
        p_text: input.text,
        p_card_ids: input.cardIds,
      }),
    ) ?? [];
  return { messageId: rows[0]?.message_id ?? null, cardIds: rows.map((r) => r.card_id) };
}

/**
 * Latest message this card should show: the latest broadcast to everyone or
 * the latest message addressed to the card (at-risk broadcast, reminder),
 * whichever is newer.
 */
export async function getLatestMessageForCard(
  db: Db,
  businessId: string,
  cardId: string,
): Promise<Message | null> {
  const personalQuery = db
    .from("message_recipients")
    .select("message_id, created_at")
    .eq("business_id", businessId)
    .eq("card_id", cardId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const [toAll, personalResult] = await Promise.all([getLatestBroadcast(db, businessId), personalQuery]);
  const personal = unwrap("getLatestMessageForCard", personalResult);
  if (!personal || (toAll && Date.parse(toAll.created_at) >= Date.parse(personal.created_at))) return toAll;
  const message = unwrap(
    "getLatestMessageForCard",
    await db
      .from("messages")
      .select("*")
      .eq("business_id", businessId)
      .eq("id", personal.message_id)
      .maybeSingle(),
  );
  return message ?? toAll;
}
