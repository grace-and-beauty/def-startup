/**
 * Derived analytics metrics (docs/architecture.md §5.5) on top of the SQL
 * aggregation RPCs. Pure functions — no I/O, unit-tested.
 */
import type { AnalyticsCardStatsRow, AnalyticsDailyRow, AnalyticsHeatmapRow } from "@/lib/data/types";

import { addDays, diffDays, toLocalDate, type DateRange, type LocalDate } from "./dates";

const DAY_MS = 86_400_000;

/** "At risk": no visit for longer than median interval × this factor. */
export const AT_RISK_FACTOR = 1.5;
/** At-risk needs a habit first: at least this many visits. */
export const AT_RISK_MIN_VISITS = 2;
/** Broadcast effect window: the day of the message + 2 days (≈ 72 h). */
export const BROADCAST_WINDOW_DAYS = 3;

export type CardStat = Pick<
  AnalyticsCardStatsRow,
  "card_id" | "customer_name" | "visits" | "first_visit_at" | "last_visit_at" | "rewards_redeemed"
>;

// ---------------------------------------------------------------------------
// Daily totals and month comparison
// ---------------------------------------------------------------------------

export interface DailyTotals {
  stamps: number;
  firstVisits: number;
  repeatVisits: number;
  rewards: number;
  newCards: number;
}

export const EMPTY_TOTALS: DailyTotals = {
  stamps: 0,
  firstVisits: 0,
  repeatVisits: 0,
  rewards: 0,
  newCards: 0,
};

/** Sums daily rows, optionally only those inside `range` (inclusive). */
export function sumDaily(rows: readonly AnalyticsDailyRow[], range?: DateRange): DailyTotals {
  const totals = { ...EMPTY_TOTALS };
  for (const row of rows) {
    if (range && (row.day < range.from || row.day > range.to)) continue;
    totals.stamps += row.stamps;
    totals.firstVisits += row.first_visits;
    totals.repeatVisits += row.repeat_visits;
    totals.rewards += row.rewards;
    totals.newCards += row.new_cards;
  }
  return totals;
}

export interface Change {
  current: number;
  previous: number;
  /** Relative change in %, null when previous is 0. */
  deltaPct: number | null;
}

export function change(current: number, previous: number): Change {
  return {
    current,
    previous,
    deltaPct: previous === 0 ? null : Math.round(((current - previous) / previous) * 100),
  };
}

/** Share of repeat visits among all visits, % (null without visits). */
export function repeatShare(totals: Pick<DailyTotals, "stamps" | "repeatVisits">): number | null {
  return totals.stamps === 0 ? null : Math.round((totals.repeatVisits / totals.stamps) * 100);
}

// ---------------------------------------------------------------------------
// Card-level metrics
// ---------------------------------------------------------------------------

export interface Retention {
  /** Cards with at least one visit. */
  visited: number;
  /** Cards with ≥ 2 visits (came back at least once). */
  returned: number;
  /** returned / visited, % (null without visits). */
  rate: number | null;
}

export function retention(cards: readonly CardStat[]): Retention {
  let visited = 0;
  let returned = 0;
  for (const card of cards) {
    if (card.visits >= 1) visited++;
    if (card.visits >= 2) returned++;
  }
  return { visited, returned, rate: visited === 0 ? null : Math.round((returned / visited) * 100) };
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Median interval between visits, days. Per card with ≥ 2 visits the
 * average gap is (last − first) / (visits − 1); the median is taken over
 * cards, so one very frequent visitor does not skew it.
 */
export function medianVisitIntervalDays(cards: readonly CardStat[]): number | null {
  const gaps: number[] = [];
  for (const card of cards) {
    if (card.visits < 2 || !card.first_visit_at || !card.last_visit_at) continue;
    const span = Date.parse(card.last_visit_at) - Date.parse(card.first_visit_at);
    if (!Number.isFinite(span) || span < 0) continue;
    gaps.push(span / DAY_MS / (card.visits - 1));
  }
  const value = median(gaps);
  return value === null ? null : Math.round(value * 10) / 10;
}

export interface AtRiskCard extends CardStat {
  daysSinceVisit: number;
}

/**
 * Regulars who stopped coming: ≥ 2 visits and no visit for longer than
 * median interval × 1.5 (at least 1 day). Most overdue first.
 */
export function atRiskCards<T extends CardStat>(
  cards: readonly T[],
  medianIntervalDays: number | null,
  now: Date,
): (T & { daysSinceVisit: number })[] {
  if (medianIntervalDays === null) return [];
  const thresholdDays = Math.max(1, medianIntervalDays * AT_RISK_FACTOR);
  const out: (T & { daysSinceVisit: number })[] = [];
  for (const card of cards) {
    if (card.visits < AT_RISK_MIN_VISITS || !card.last_visit_at) continue;
    const days = (now.getTime() - Date.parse(card.last_visit_at)) / DAY_MS;
    if (days > thresholdDays) out.push({ ...card, daysSinceVisit: Math.floor(days) });
  }
  return out.sort((a, b) => b.daysSinceVisit - a.daysSinceVisit);
}

/** Top customers by visits (ties: most recent visit first). */
export function topCards<T extends CardStat>(cards: readonly T[], limit = 20): T[] {
  return cards
    .filter((c) => c.visits > 0)
    .sort(
      (a, b) =>
        b.visits - a.visits ||
        (Date.parse(b.last_visit_at ?? "") || 0) - (Date.parse(a.last_visit_at ?? "") || 0),
    )
    .slice(0, limit);
}

/** Cards with a visit within the last `days` days. */
export function activeCards(cards: readonly CardStat[], now: Date, days = 30): number {
  const since = now.getTime() - days * DAY_MS;
  return cards.filter((c) => c.last_visit_at && Date.parse(c.last_visit_at) >= since).length;
}

export interface ReturnWithin {
  /** Cards whose first visit was at least `days` ago (the cohort can be judged). */
  cohort: number;
  /** Of them: second visit within `days` after the first. */
  returned: number;
  /** returned / cohort, % (null for an empty cohort). */
  rate: number | null;
}

/**
 * "% повернулись за 30 днів": among cards whose first visit was ≥ `days`
 * ago, the share whose second visit came within `days` of the first.
 * Younger cards are left out — they had no fair chance to come back yet.
 */
export function returnedWithin(
  cards: readonly (CardStat & { second_visit_at?: string | null })[],
  now: Date,
  days = 30,
): ReturnWithin {
  const windowMs = days * DAY_MS;
  let cohort = 0;
  let returned = 0;
  for (const card of cards) {
    const first = card.first_visit_at ? Date.parse(card.first_visit_at) : NaN;
    if (Number.isNaN(first) || now.getTime() - first < windowMs) continue;
    cohort++;
    const second = card.second_visit_at ? Date.parse(card.second_visit_at) : NaN;
    if (!Number.isNaN(second) && second - first <= windowMs) returned++;
  }
  return { cohort, returned, rate: cohort === 0 ? null : Math.round((returned / cohort) * 100) };
}

/** Cards holding rewards that were earned but not handed out yet. */
export function pendingRewards(cards: readonly { rewards_available: number }[]): { cards: number; rewards: number } {
  let count = 0;
  let rewards = 0;
  for (const card of cards) {
    if (card.rewards_available > 0) {
      count++;
      rewards += card.rewards_available;
    }
  }
  return { cards: count, rewards };
}

/**
 * Suggested reminder delay: median interval × 1.5 (the at-risk threshold),
 * rounded, within 1…365 days. null without enough data.
 */
export function suggestedReminderDays(medianIntervalDays: number | null): number | null {
  if (medianIntervalDays === null) return null;
  return Math.min(365, Math.max(1, Math.round(medianIntervalDays * AT_RISK_FACTOR)));
}

// ---------------------------------------------------------------------------
// Money, peak hours, broadcast effect
// ---------------------------------------------------------------------------

/** "How much the program brought": repeat visits × average check (null without avg_check). */
export function programRevenue(repeatVisits: number, avgCheck: number | null): number | null {
  return avgCheck === null || avgCheck <= 0 ? null : repeatVisits * avgCheck;
}

export interface PeakCell {
  dow: number;
  hour: number;
  stamps: number;
}

/** Busiest weekday × hour cell (ISO weekday 1 = Mon). */
export function peakCell(rows: readonly AnalyticsHeatmapRow[]): PeakCell | null {
  let best: PeakCell | null = null;
  for (const row of rows) {
    if (!best || row.stamps > best.stamps) best = { dow: row.dow, hour: row.hour, stamps: row.stamps };
  }
  return best && best.stamps > 0 ? best : null;
}

/** Heatmap rows → dense 7 × 24 matrix [dow-1][hour]. */
export function heatmapMatrix(rows: readonly AnalyticsHeatmapRow[]): number[][] {
  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const row of rows) {
    if (row.dow >= 1 && row.dow <= 7 && row.hour >= 0 && row.hour <= 23) {
      matrix[row.dow - 1][row.hour] += row.stamps;
    }
  }
  return matrix;
}

export interface BroadcastEffect {
  messageId: string;
  text: string;
  sentAt: string;
  day: LocalDate;
  /** Visits on the message day + the next 2 days. */
  visitsAfter: number;
  /** Average visits of any 3-day window in the analysed range. */
  baseline: number;
  /** Relative lift, % (null when the baseline is 0). */
  liftPct: number | null;
  /** The 3-day window has not finished yet. */
  partial: boolean;
}

/**
 * Effect of broadcasts: visits in ≈72 h after a message vs the average
 * 3-day number of visits over `range`. Day granularity in the business timezone.
 */
export function broadcastEffects(
  daily: readonly AnalyticsDailyRow[],
  messages: readonly { id: string; text: string; created_at: string }[],
  range: DateRange,
  timeZone: string,
): BroadcastEffect[] {
  const byDay = new Map(daily.map((row) => [row.day, row.stamps] as const));
  const totalDays = diffDays(range.from, range.to) + 1;
  const total = sumDaily(daily, range).stamps;
  const baseline = totalDays > 0 ? (total / totalDays) * BROADCAST_WINDOW_DAYS : 0;

  const out: BroadcastEffect[] = [];
  for (const message of messages) {
    const day = toLocalDate(new Date(message.created_at), timeZone);
    if (day < range.from || day > range.to) continue;
    let visitsAfter = 0;
    for (let i = 0; i < BROADCAST_WINDOW_DAYS; i++) visitsAfter += byDay.get(addDays(day, i)) ?? 0;
    const partial = addDays(day, BROADCAST_WINDOW_DAYS - 1) > range.to;
    out.push({
      messageId: message.id,
      text: message.text,
      sentAt: message.created_at,
      day,
      visitsAfter,
      baseline: Math.round(baseline * 10) / 10,
      liftPct: baseline === 0 ? null : Math.round(((visitsAfter - baseline) / baseline) * 100),
      partial,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Insights (shown as hints with actions)
// ---------------------------------------------------------------------------

export type Insight =
  | { kind: "atRisk"; count: number }
  | { kind: "remindersOff"; days: number | null }
  | { kind: "pendingRewards"; count: number }
  | { kind: "decline"; pct: number }
  | { kind: "growth"; pct: number }
  | { kind: "lowRetention"; rate: number }
  | { kind: "broadcastWorked"; pct: number }
  | { kind: "noRecentBroadcast"; days: number | null }
  | { kind: "peak"; dow: number; hour: number }
  | { kind: "noAvgCheck" };

export type InsightKind = Insight["kind"];

/** Where a hint's action button leads (the UI renders the label). */
export type InsightAction = "broadcastAtRisk" | "broadcast" | "reminders" | "avgCheck" | null;

export function insightAction(insight: Insight): InsightAction {
  switch (insight.kind) {
    case "atRisk":
      return "broadcastAtRisk";
    case "remindersOff":
    case "lowRetention":
      return "reminders";
    case "pendingRewards":
    case "decline":
    case "noRecentBroadcast":
    case "broadcastWorked":
      return "broadcast";
    case "noAvgCheck":
      return "avgCheck";
    case "growth":
    case "peak":
      return null;
  }
}

/** No broadcast for this many days → suggest one. */
export const QUIET_BROADCAST_DAYS = 30;
/** A broadcast "worked" when visits in its 3-day window beat the baseline by this much, %. */
export const BROADCAST_WORKED_PCT = 20;

/**
 * Text hints for the analytics screen, most actionable first. Each hint maps
 * to an action button via insightAction().
 */
export function insights(input: {
  atRiskCount: number;
  peak: PeakCell | null;
  stampsChange: Change;
  retentionRate: number | null;
  avgCheck: number | null;
  /** Program reminders switched on (only checked when the plan has them). */
  remindersEnabled?: boolean;
  remindersAvailable?: boolean;
  suggestedReminderDays?: number | null;
  pendingRewardCards?: number;
  effects?: readonly Pick<BroadcastEffect, "liftPct" | "partial">[];
  /** Days since the last broadcast (null = never). */
  daysSinceBroadcast?: number | null;
  totalCards?: number;
}): Insight[] {
  const out: Insight[] = [];
  if (input.atRiskCount > 0) out.push({ kind: "atRisk", count: input.atRiskCount });
  if (input.remindersAvailable && input.remindersEnabled === false && input.atRiskCount > 0) {
    out.push({ kind: "remindersOff", days: input.suggestedReminderDays ?? null });
  }
  if ((input.pendingRewardCards ?? 0) > 0) out.push({ kind: "pendingRewards", count: input.pendingRewardCards ?? 0 });
  const delta = input.stampsChange.deltaPct;
  if (delta !== null && delta <= -10) out.push({ kind: "decline", pct: Math.abs(delta) });
  if (delta !== null && delta >= 10) out.push({ kind: "growth", pct: delta });
  if (input.retentionRate !== null && input.retentionRate < 30) {
    out.push({ kind: "lowRetention", rate: input.retentionRate });
  }
  const best = (input.effects ?? [])
    .filter((e) => !e.partial && e.liftPct !== null)
    .reduce<number | null>((max, e) => (max === null || (e.liftPct ?? 0) > max ? e.liftPct : max), null);
  if (best !== null && best >= BROADCAST_WORKED_PCT) out.push({ kind: "broadcastWorked", pct: best });
  if (
    (input.totalCards ?? 0) > 0 &&
    input.daysSinceBroadcast !== undefined &&
    (input.daysSinceBroadcast === null || input.daysSinceBroadcast >= QUIET_BROADCAST_DAYS)
  ) {
    out.push({ kind: "noRecentBroadcast", days: input.daysSinceBroadcast });
  }
  if (input.peak) out.push({ kind: "peak", dow: input.peak.dow, hour: input.peak.hour });
  if (input.avgCheck === null || input.avgCheck <= 0) out.push({ kind: "noAvgCheck" });
  return out;
}
