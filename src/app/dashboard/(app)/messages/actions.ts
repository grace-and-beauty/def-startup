"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ownerContextForAction } from "@/lib/auth/owner";
import { listGoogleRecipientCardIds, sendBroadcastRpc } from "@/lib/data";
import { broadcastTextSchema, formString } from "@/lib/domain/business-input";
import { getLimit, hasFeature } from "@/lib/domain/plans";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { scheduleWalletTask } from "@/lib/wallet/background";

import { listAtRiskCards } from "./recipients";
import type { BroadcastState, BroadcastTarget } from "./types";
import { logEvent } from "@/lib/log";

const targetSchema = z
  .union([z.literal(""), z.enum(["all", "at_risk"])])
  .transform((value): BroadcastTarget => (value === "" ? "all" : value));

/** Google Wallet: messages to many single passes are sent in small batches. */
const WALLET_BATCH = 5;

/**
 * Broadcast to all cards or to at-risk customers (architecture §5.3):
 *  1. plan checks — at_risk needs the analytics feature (Plus), the monthly
 *     quota comes from getLimit(broadcastsPerMonth);
 *  2. RPC send_broadcast: quota check + messages row (+ recipients for
 *     at_risk) under one lock, so parallel sends can't exceed the quota.
 *     Called with the service role after the owner check above — owners
 *     can't call it directly, because the quota is a parameter;
 *  3. after the response: a Google Wallet message to each recipient's pass
 *     (only customers who opted in). Wallet errors are logged, the broadcast stays.
 * The web card shows the latest message for the card (loaders.ts).
 */
export async function sendBroadcast(prev: BroadcastState, formData: FormData): Promise<BroadcastState> {
  const fail = (reason: Extract<BroadcastState, { status: "error" }>["reason"]): BroadcastState => ({
    sent: prev.sent,
    status: "error",
    reason,
  });

  const ctx = await ownerContextForAction();
  if (!ctx) return fail("sessionExpired");
  const { supabase, business, program } = ctx;
  const now = new Date();

  const text = broadcastTextSchema.safeParse(formString(formData, "text"));
  if (!text.success) return fail("textInvalid");
  const targetParsed = targetSchema.safeParse(formString(formData, "target"));
  if (!targetParsed.success) return fail("targetInvalid");
  const target: BroadcastTarget = targetParsed.data;
  if (target === "at_risk" && !hasFeature(business, "analytics", now)) return fail("targetInvalid");

  const limit = getLimit(business, "broadcastsPerMonth", now);
  if (limit <= 0) return fail("quotaExhausted");
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return fail("unknown");

  let recipients: number;
  try {
    const atRisk = target === "at_risk" ? await listAtRiskCards(supabase, business.id, now) : [];
    if (target === "at_risk" && atRisk.length === 0) return fail("noRecipients");

    const result = await sendBroadcastRpc(admin, {
      businessId: business.id,
      target,
      text: text.data,
      cardIds: target === "at_risk" ? atRisk.map((card) => card.card_id) : null,
      maxPerMonth: limit,
    });
    if (result.status === "quota_exhausted") return fail("quotaExhausted");
    if (result.status === "no_recipients" || !result.message_id) return fail("noRecipients");
    recipients = result.recipients_count;
    logEvent("info", "broadcast_sent", { businessId: business.id, target, recipients });

    // Google Wallet: one message per opted-in pass. A class-wide message
    // would reach every pass, including customers who did not opt in.
    const message = { id: `msg_${result.message_id}`, text: text.data };
    const messageId = result.message_id;
    scheduleWalletTask("messageCards", async (wallet) => {
      const cardIds = await listGoogleRecipientCardIds(admin, business.id, messageId);
      let failed = 0;
      for (let i = 0; i < cardIds.length; i += WALLET_BATCH) {
        const results = await Promise.allSettled(
          cardIds.slice(i, i + WALLET_BATCH).map((id) => wallet.messageCard({ id }, program, business, message)),
        );
        failed += results.filter((r) => r.status === "rejected").length;
      }
      if (failed > 0) throw new Error(`${failed} of ${cardIds.length} passes failed`);
    });
  } catch (error) {
    logEvent("error", "broadcast_failed", { error });
    return fail("unknown");
  }

  revalidatePath("/dashboard/messages");
  return { sent: prev.sent + 1, status: "ok", recipients };
}
