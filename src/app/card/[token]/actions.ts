"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { MARKETING_CONSENT_VERSION } from "@/config/consent";
import { setMarketingConsent } from "@/lib/data";
import { logEvent } from "@/lib/log";
import { isValidQrToken } from "@/lib/security/tokens";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

export type ConsentState = { status: "idle" } | { status: "ok"; granted: boolean } | { status: "error" };

const grantedSchema = z.enum(["true", "false"]).transform((value) => value === "true");

/**
 * The customer turns messages from the business on / off on their own card.
 * The card token in the URL is the credential (same as viewing the card).
 */
export async function updateConsent(token: string, _prev: ConsentState, formData: FormData): Promise<ConsentState> {
  const granted = grantedSchema.safeParse(formData.get("granted"));
  if (!isValidQrToken(token) || !granted.success) return { status: "error" };
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return { status: "error" };
  try {
    const result = await setMarketingConsent(admin, {
      qrToken: token,
      granted: granted.data,
      consentVersion: MARKETING_CONSENT_VERSION,
    });
    if (result === null) return { status: "error" };
    logEvent("info", "consent_changed", { granted: result, source: "web_card" });
    revalidatePath(`/card/${token}`);
    return { status: "ok", granted: result };
  } catch (error) {
    logEvent("error", "consent_change_failed", { error });
    return { status: "error" };
  }
}
