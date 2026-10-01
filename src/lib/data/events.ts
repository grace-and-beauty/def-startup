import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type {
  AnalyticsCardStatsRow,
  AnalyticsDailyRow,
  AnalyticsHeatmapRow,
  AnalyticsStaffRow,
  StampEvent,
  StampEventType,
} from "./types";

/** Dates for analytics RPCs are local calendar dates of the business: "YYYY-MM-DD". */
export type LocalDate = string;

export async function listCardEvents(
  db: Db,
  businessId: string,
  cardId: string,
  limit = 50,
): Promise<StampEvent[]> {
  return (
    unwrap(
      "listCardEvents",
      await db
        .from("stamp_events")
        .select("*")
        .eq("business_id", businessId)
        .eq("card_id", cardId)
        .order("created_at", { ascending: false })
        .limit(limit),
    ) ?? []
  );
}

export async function listEvents(
  db: Db,
  businessId: string,
  range: { from: Date; to: Date },
): Promise<StampEvent[]> {
  return (
    unwrap(
      "listEvents",
      await db
        .from("stamp_events")
        .select("*")
        .eq("business_id", businessId)
        .gte("created_at", range.from.toISOString())
        .lt("created_at", range.to.toISOString())
        .order("created_at", { ascending: true }),
    ) ?? []
  );
}

export async function countEvents(
  db: Db,
  businessId: string,
  type: StampEventType,
  range: { from: Date; to?: Date },
): Promise<number> {
  let query = db
    .from("stamp_events")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("type", type)
    .gte("created_at", range.from.toISOString());
  if (range.to) query = query.lt("created_at", range.to.toISOString());
  const { count, error } = await query;
  unwrap("countEvents", { data: null, error });
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Analytics RPCs (docs/architecture.md §5.5). Owner client or service role.
// ---------------------------------------------------------------------------

export async function analyticsDaily(
  db: Db,
  businessId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<AnalyticsDailyRow[]> {
  return unwrapRequired(
    "analyticsDaily",
    await db.rpc("analytics_daily", { bid: businessId, p_from: from, p_to: to }),
  );
}

export async function analyticsHeatmap(
  db: Db,
  businessId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<AnalyticsHeatmapRow[]> {
  return unwrapRequired(
    "analyticsHeatmap",
    await db.rpc("analytics_heatmap", { bid: businessId, p_from: from, p_to: to }),
  );
}

export async function analyticsCardStats(
  db: Db,
  businessId: string,
): Promise<AnalyticsCardStatsRow[]> {
  return unwrapRequired(
    "analyticsCardStats",
    await db.rpc("analytics_card_stats", { bid: businessId }),
  );
}

export async function analyticsStaff(
  db: Db,
  businessId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<AnalyticsStaffRow[]> {
  return unwrapRequired(
    "analyticsStaff",
    await db.rpc("analytics_staff", { bid: businessId, p_from: from, p_to: to }),
  );
}
