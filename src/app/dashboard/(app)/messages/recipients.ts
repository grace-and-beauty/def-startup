import "server-only";

import { analyticsCardStats, countCards, type AnalyticsCardStatsRow } from "@/lib/data";
import { atRiskCards, medianVisitIntervalDays } from "@/lib/domain/analytics";
import { startOfMonth, toLocalDate, zonedMidnight } from "@/lib/domain/dates";
import type { Db } from "@/lib/supabase/types";

/** At-risk cards (domain/analytics.ts rule) with the fields a broadcast needs. */
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

/** Cards a broadcast to `all` / `at_risk` would reach. */
export async function countRecipients(db: Db, businessId: string, now: Date) {
  const [all, atRisk] = await Promise.all([countCards(db, businessId), listAtRiskCards(db, businessId, now)]);
  return { all, atRisk: atRisk.length };
}

/** Start of the current calendar month in the business timezone (broadcast quota). */
export function monthStart(now: Date, timeZone: string): Date {
  return zonedMidnight(startOfMonth(toLocalDate(now, timeZone)), timeZone);
}
