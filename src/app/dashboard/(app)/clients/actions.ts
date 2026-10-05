"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ownerContextForAction } from "@/lib/auth/owner";
import { anonymizeCustomer } from "@/lib/data";
import { logEvent } from "@/lib/log";

export type AnonymizeState = { status: "idle" } | { status: "ok" } | { status: "error" };

/**
 * Removes a customer's personal data on the owner's request (or the
 * customer's). The database function checks ownership again and writes the
 * audit record; the visit journal stays for the business' statistics.
 */
export async function anonymizeCustomerAction(customerId: string, _prev: AnonymizeState): Promise<AnonymizeState> {
  const id = z.uuid().safeParse(customerId);
  if (!id.success) return { status: "error" };
  const ctx = await ownerContextForAction();
  if (!ctx) return { status: "error" };
  try {
    await anonymizeCustomer(ctx.supabase, id.data);
    logEvent("info", "customer_anonymized", { businessId: ctx.business.id, customerId: id.data, actor: "owner" });
  } catch (error) {
    logEvent("error", "action_failed", { action: "anonymizeCustomer", businessId: ctx.business.id, error });
    return { status: "error" };
  }
  revalidatePath("/dashboard/clients");
  return { status: "ok" };
}
