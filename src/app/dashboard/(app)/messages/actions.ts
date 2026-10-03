"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ownerContextForAction } from "@/lib/auth/owner";
import { sendBroadcastRpc } from "@/lib/data";
import { broadcastTextSchema, formString } from "@/lib/domain/business-input";
import { getLimit, hasFeature } from "@/lib/domain/plans";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { scheduleWalletTask } from "@/lib/wallet/background";

import { listAtRiskCards } from "./recipients";
import type { BroadcastState, BroadcastTarget } from "./types";

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
 *  3. after the response: Google Wallet message to the class (all) or to
 *     each at-risk Google pass. Wallet errors are logged, the broadcast stays.
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

    const message = { id: `msg_${result.message_id}`, text: text.data };
    if (target === "all") {
      scheduleWalletTask("broadcast", (wallet) => wallet.broadcast(program, business, message));
    } else {
      const googleCards = atRisk.filter((card) => card.wallet_type === "google");
      if (googleCards.length > 0) {
        scheduleWalletTask("messageCards", async (wallet) => {
          let failed = 0;
          for (let i = 0; i < googleCards.length; i += WALLET_BATCH) {
            const batch = googleCards.slice(i, i + WALLET_BATCH);
            const results = await Promise.allSettled(
              batch.map((card) => wallet.messageCard({ id: card.card_id }, program, business, message)),
            );
            failed += results.filter((r) => r.status === "rejected").length;
          }
          if (failed > 0) throw new Error(`${failed} of ${googleCards.length} passes failed`);
        });
      }
    }
  } catch (error) {
    console.error("sendBroadcast failed", error instanceof Error ? error.message : error);
    return fail("unknown");
  }

  revalidatePath("/dashboard/messages");
  return { sent: prev.sent + 1, status: "ok", recipients };
}
