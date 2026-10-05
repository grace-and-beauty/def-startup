import "server-only";

import { analyticsCardStats, listConsentedCardIds, type AnalyticsCardStatsRow } from "@/lib/data";
import { atRiskCards, medianVisitIntervalDays } from "@/lib/domain/analytics";
import { startOfMonth, toLocalDate, zonedMidnight } from "@/lib/domain/dates";
import type { Db } from "@/lib/supabase/types";

/** At-risk cards (domain/analytics.ts rule) with the fields a broadcast needs (all, opted in or not). */
export async function listAtRiskCards(
  db: Db,
  businessId: string,
  now: Date,
): Promise<Pick<AnalyticsCardStatsRow, "card_id" | "wallet_type">[]> {
  const stats = await analyticsCardStats(db, businessId);
  return atRiskCards(stats, medianVisitIntervalDays(stats), now).map(({ card_id, wallet_type }) => ({
    card_id,
    wallet_type,
  }));
}

/** Cards a broadcast to `all` / `at_risk` would reach: only customers who opted in. */
export async function countRecipients(db: Db, businessId: string, now: Date) {
  const [consented, atRisk] = await Promise.all([listConsentedCardIds(db, businessId), listAtRiskCards(db, businessId, now)]);
  return { all: consented.size, atRisk: atRisk.filter((card) => consented.has(card.card_id)).length };
}

/** Start of the current calendar month in the business timezone (broadcast quota). */
export function monthStart(now: Date, timeZone: string): Date {
  return zonedMidnight(startOfMonth(toLocalDate(now, timeZone)), timeZone);
}
