import "server-only";

import { analyticsCardStats, countCards } from "@/lib/data";
import { atRiskCards, medianVisitIntervalDays } from "@/lib/domain/analytics";
import { startOfMonth, toLocalDate, zonedMidnight } from "@/lib/domain/dates";
import type { Db } from "@/lib/supabase/types";

/** Cards a broadcast to `all` / `at_risk` would reach. */
export async function countRecipients(db: Db, businessId: string, now: Date) {
  const [all, stats] = await Promise.all([countCards(db, businessId), analyticsCardStats(db, businessId)]);
  const atRisk = atRiskCards(stats, medianVisitIntervalDays(stats), now).length;
  return { all, atRisk };
}

/** Start of the current calendar month in the business timezone (broadcast quota). */
export function monthStart(now: Date, timeZone: string): Date {
  return zonedMidnight(startOfMonth(toLocalDate(now, timeZone)), timeZone);
}
