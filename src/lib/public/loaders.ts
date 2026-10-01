import "server-only";

import { cache } from "react";

import {
  countCustomers,
  getCardByToken,
  getLatestBroadcast,
  getPublicBusinessById,
  getPublicBusinessBySlug,
  getPublicProgramByBusinessId,
  type BusinessPublic,
  type CardWithCustomer,
  type Message,
  type ProgramPublic,
} from "@/lib/data";
import { canAcceptCustomer, canIssueCards, getLimit } from "@/lib/domain/plans";
import { isValidSlug } from "@/lib/domain/slug";
import { isValidQrToken } from "@/lib/security/tokens";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Loaders for public pages and the scanner (docs/architecture.md §4.2):
 * service-role client, every query filtered by the business derived from the
 * slug / qr_token. Wrapped in React cache() so generateMetadata and the page
 * share one query per request.
 *
 * Result "unavailable" = Supabase env is not configured.
 */

export type Loaded<T> = { status: "ok"; data: T } | { status: "not_found" } | { status: "unavailable" };

export interface PublicBusinessBundle {
  business: BusinessPublic;
  program: ProgramPublic;
}

export const loadPublicBusiness = cache(
  async (slug: string): Promise<Loaded<PublicBusinessBundle>> => {
    if (!isValidSlug(slug)) return { status: "not_found" };
    const admin = tryCreateSupabaseAdminClient();
    if (!admin) return { status: "unavailable" };

    const business = await getPublicBusinessBySlug(admin, slug);
    if (!business) return { status: "not_found" };
    const program = await getPublicProgramByBusinessId(admin, business.id);
    if (!program) return { status: "not_found" };
    return { status: "ok", data: { business, program } };
  },
);

export interface PublicCardBundle extends PublicBusinessBundle {
  card: CardWithCustomer;
  latestMessage: Message | null;
}

export const loadPublicCard = cache(async (token: string): Promise<Loaded<PublicCardBundle>> => {
  if (!isValidQrToken(token)) return { status: "not_found" };
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return { status: "unavailable" };

  const card = await getCardByToken(admin, token);
  if (!card) return { status: "not_found" };
  const [business, program, latestMessage] = await Promise.all([
    getPublicBusinessById(admin, card.business_id),
    getPublicProgramByBusinessId(admin, card.business_id),
    getLatestBroadcast(admin, card.business_id),
  ]);
  if (!business || !program) return { status: "not_found" };
  return { status: "ok", data: { business, program, card, latestMessage } };
});

/**
 * /c/[slug] shows the join form only while the business can issue cards
 * (not canceled / inactive, docs/architecture.md §6.2) and is below its
 * plan's customer limit. joinProgram re-checks both atomically.
 */
export async function isAcceptingCustomers(business: BusinessPublic, now: Date): Promise<boolean> {
  if (!canIssueCards(business, now)) return false;
  if (!Number.isFinite(getLimit(business, "customers", now))) return true;
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return false;
  return canAcceptCustomer(business, await countCustomers(admin, business.id), now);
}
