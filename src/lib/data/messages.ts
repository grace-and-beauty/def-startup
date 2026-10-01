import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type { Message, MessageKind, TablesInsert } from "./types";

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
