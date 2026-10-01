"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { DataError, hitRateLimit, issueCard } from "@/lib/data";
import { slugSchema } from "@/lib/domain/business-input";
import { customerNameSchema, customerPhoneSchema } from "@/lib/domain/customer-input";
import { canIssueCards, getLimit } from "@/lib/domain/plans";
import { ipHashSecret, MissingEnvError } from "@/lib/env";
import { loadPublicBusiness } from "@/lib/public/loaders";
import { clientIpFromHeaders, hashIp, JOIN_RATE_LIMIT } from "@/lib/security/rate-limit";
import { generateQrToken } from "@/lib/security/tokens";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

export type JoinState =
  | { status: "idle" }
  | { status: "ok"; token: string }
  | {
      status: "error";
      reason:
        | "invalidName"
        | "invalidPhone"
        | "notFound"
        | "unavailable"
        | "programUnavailable"
        | "rateLimited"
        | "unknown";
    };

const joinSchema = z.object({
  slug: slugSchema,
  name: customerNameSchema,
  phone: customerPhoneSchema,
});

function ipHashSecretOrNull(): string | null {
  try {
    return ipHashSecret();
  } catch (error) {
    if (error instanceof MissingEnvError) return null;
    throw error;
  }
}

/**
 * Customer joins the program of /c/[slug] (docs/architecture.md §5.1):
 *  1. validate input (zod);
 *  2. the business must be able to issue cards (not canceled / inactive);
 *  3. rate limit: ≤ 10 new cards per minute per IP (hashed) per business;
 *  4. RPC issue_card: customer + card in one transaction, plan customer
 *     limit checked under a per-business lock; new random qr_token.
 * Returns the card token for /card/[token]. "Add to Google Wallet" is a link
 * to /api/wallet/google/[token] (shown only when the provider is configured),
 * which builds the save link on demand.
 */
export async function joinProgram(
  slug: string,
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const parsed = joinSchema.safeParse({
    slug,
    name: formData.get("name"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    if (field === "name") return { status: "error", reason: "invalidName" };
    if (field === "phone") return { status: "error", reason: "invalidPhone" };
    return { status: "error", reason: "notFound" };
  }
  const { name, phone } = parsed.data;

  const loaded = await loadPublicBusiness(parsed.data.slug);
  if (loaded.status === "unavailable") return { status: "error", reason: "unavailable" };
  if (loaded.status === "not_found") return { status: "error", reason: "notFound" };
  const { business } = loaded.data;

  const now = new Date();
  if (!canIssueCards(business, now)) return { status: "error", reason: "programUnavailable" };

  const admin = tryCreateSupabaseAdminClient();
  const ipSecret = ipHashSecretOrNull();
  if (!admin || !ipSecret) return { status: "error", reason: "unavailable" };

  try {
    const allowed = await hitRateLimit(admin, {
      scope: JOIN_RATE_LIMIT.scope,
      businessId: business.id,
      keyHash: hashIp(clientIpFromHeaders(await headers()), ipSecret),
      max: JOIN_RATE_LIMIT.max,
      windowSeconds: JOIN_RATE_LIMIT.windowSeconds,
    });
    if (!allowed) return { status: "error", reason: "rateLimited" };

    const maxCustomers = getLimit(business, "customers", now);
    // A 128-bit collision is practically impossible; one retry covers it anyway.
    for (let attempt = 0; attempt < 2; attempt++) {
      const qrToken = generateQrToken();
      try {
        const result = await issueCard(admin, {
          businessId: business.id,
          name,
          phone,
          qrToken,
          maxCustomers: Number.isFinite(maxCustomers) ? maxCustomers : null,
        });
        if (result.status === "limit_reached") return { status: "error", reason: "programUnavailable" };
        if (result.status === "not_found") return { status: "error", reason: "notFound" };
        return { status: "ok", token: qrToken };
      } catch (error) {
        if (!(error instanceof DataError && error.isUniqueViolation) || attempt > 0) throw error;
      }
    }
    return { status: "error", reason: "unknown" };
  } catch (error) {
    console.error("joinProgram failed", error instanceof Error ? error.message : error);
    return { status: "error", reason: "unknown" };
  }
}
