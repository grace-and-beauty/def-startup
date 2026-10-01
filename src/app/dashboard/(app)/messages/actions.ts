"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ownerContextForAction } from "@/lib/auth/owner";
import { countMessagesSince, insertMessage } from "@/lib/data";
import { broadcastTextSchema, formString } from "@/lib/domain/business-input";
import { getLimit, hasFeature, remaining } from "@/lib/domain/plans";

import { countRecipients, monthStart } from "./recipients";
import type { BroadcastState, BroadcastTarget } from "./types";

const targetSchema = z
  .union([z.literal(""), z.enum(["all", "at_risk"])])
  .transform((value): BroadcastTarget => (value === "" ? "all" : value));

/**
 * Broadcast to all cards or to at-risk customers (architecture §5.3):
 * plan quota (Basic: 2 per calendar month in the business timezone) →
 * messages row → web card shows it.
 * TODO(stage 3): wallet.broadcast() / wallet.messageCard() for Google Wallet cards.
 */
export async function sendBroadcast(prev: BroadcastState, formData: FormData): Promise<BroadcastState> {
  const fail = (reason: Extract<BroadcastState, { status: "error" }>["reason"]): BroadcastState => ({
    sent: prev.sent,
    status: "error",
    reason,
  });

  const ctx = await ownerContextForAction();
  if (!ctx) return fail("sessionExpired");
  const { supabase, business } = ctx;
  const now = new Date();

  const text = broadcastTextSchema.safeParse(formString(formData, "text"));
  if (!text.success) return fail("textInvalid");
  const targetParsed = targetSchema.safeParse(formString(formData, "target"));
  if (!targetParsed.success) return fail("targetInvalid");
  const target: BroadcastTarget = targetParsed.data;
  if (target === "at_risk" && !hasFeature(business, "analytics", now)) return fail("targetInvalid");

  let count: number;
  try {
    const used = await countMessagesSince(supabase, business.id, "broadcast", monthStart(now, business.timezone));
    if (remaining(getLimit(business, "broadcastsPerMonth", now), used) <= 0) return fail("quotaExhausted");

    const recipients = await countRecipients(supabase, business.id, now);
    count = target === "all" ? recipients.all : recipients.atRisk;
    if (count === 0) return fail("noRecipients");

    await insertMessage(supabase, {
      business_id: business.id,
      kind: "broadcast",
      target,
      text: text.data,
      recipients_count: count,
    });
  } catch (error) {
    console.error("sendBroadcast failed", error instanceof Error ? error.message : error);
    return fail("unknown");
  }

  revalidatePath("/dashboard/messages");
  return { sent: prev.sent + 1, status: "ok", recipients: count };
}
