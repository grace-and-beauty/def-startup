"use server";

import { createCard, createCustomer, DataError } from "@/lib/data";
import { normalizeCustomerName, normalizePhone } from "@/lib/domain/customer-input";
import { loadPublicBusiness } from "@/lib/public/loaders";
import { generateQrToken } from "@/lib/security/tokens";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type JoinState =
  | { status: "idle" }
  | { status: "ok"; token: string }
  | {
      status: "error";
      reason: "invalidName" | "invalidPhone" | "notFound" | "unavailable" | "unknown";
    };

/**
 * Customer joins the program of /c/[slug]: creates customer + card and
 * returns the card token.
 *
 * TODO(stage 3): plan customer limit + inactive business (domain/plans.ts),
 * rate limit ≤10 new cards/min per IP per business (architecture §5.1),
 * wallet provider.
 */
export async function joinProgram(
  slug: string,
  _prev: JoinState,
  formData: FormData,
): Promise<JoinState> {
  const name = normalizeCustomerName(formData.get("name"));
  if (name === undefined) return { status: "error", reason: "invalidName" };
  const phone = normalizePhone(formData.get("phone"));
  if (phone === undefined) return { status: "error", reason: "invalidPhone" };

  const loaded = await loadPublicBusiness(String(slug));
  if (loaded.status === "unavailable") return { status: "error", reason: "unavailable" };
  if (loaded.status === "not_found") return { status: "error", reason: "notFound" };
  const { business, program } = loaded.data;

  try {
    const admin = createSupabaseAdminClient();
    const customer = await createCustomer(admin, { businessId: business.id, name, phone });

    // A 128-bit collision is practically impossible; one retry covers it anyway.
    for (let attempt = 0; attempt < 2; attempt++) {
      const qrToken = generateQrToken();
      try {
        await createCard(admin, {
          businessId: business.id,
          programId: program.id,
          customerId: customer.id,
          qrToken,
        });
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
