import type {
  AnalyticsCardStatsRow,
  AnalyticsDailyRow,
  AnalyticsHeatmapRow,
  AnalyticsStaffRow,
  Message,
} from "@/lib/data";
import {
  activeCards,
  atRiskCards,
  broadcastEffects,
  change,
  heatmapMatrix,
  insights,
  medianVisitIntervalDays,
  peakCell,
  pendingRewards,
  programRevenue,
  retention,
  returnedWithin,
  suggestedReminderDays,
  sumDaily,
  topCards,
  type AtRiskCard,
  type BroadcastEffect,
  type Change,
  type DailyTotals,
  type Insight,
  type PeakCell,
  type Retention,
  type ReturnWithin,
} from "@/lib/domain/analytics";
import { addDays, monthToDateComparison, parseLocalDate, type DateRange, type LocalDate } from "@/lib/domain/dates";
import { formatShortDay } from "@/lib/format";

export const PERIODS = [30, 90] as const;
export type Period = (typeof PERIODS)[number];

export function parsePeriod(value: unknown): Period {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as Period) : 30;
}

export interface AnalyticsInputs {
  today: LocalDate;
  period: Period;
  timezone: string;
  avgCheck: number | null;
  now: Date;
  daily: AnalyticsDailyRow[];
  heatmap: AnalyticsHeatmapRow[];
  cards: AnalyticsCardStatsRow[];
  staff: AnalyticsStaffRow[];
  broadcasts: Pick<Message, "id" | "text" | "created_at">[];
  /** Plan has automatic reminders (hasFeature "reminders"). */
  remindersAvailable: boolean;
  remindersEnabled: boolean;
}

export interface AnalyticsModel {
  period: Period;
  range: DateRange;
  timezone: string;
  avgCheck: number | null;
  comparisonDay: number;
  comparison: Record<"stamps" | "newCards" | "repeatVisits" | "rewards", Change>;
  periodTotals: DailyTotals;
  retention: Retention;
  returned30: ReturnWithin;
  pendingRewards: { cards: number; rewards: number };
  suggestedReminderDays: number | null;
  medianInterval: number | null;
  activeCount: number;
  revenue: number | null;
  daily: { label: string; newVisits: number; repeatVisits: number }[];
  heatmap: number[][];
  peak: PeakCell | null;
  atRisk: AtRiskCard[];
  top: AnalyticsCardStatsRow[];
  effects: BroadcastEffect[];
  staff: AnalyticsStaffRow[];
  insights: Insight[];
}

/** Dates the page has to query for `period` (daily rows also cover last month). */
export function analyticsQueryRange(today: LocalDate, period: Period) {
  const range = { from: addDays(today, -(period - 1)), to: today };
  const { previous } = monthToDateComparison(today);
  return { range, dailyFrom: previous.from < range.from ? previous.from : range.from };
}

export function buildAnalyticsModel(input: AnalyticsInputs): AnalyticsModel {
  const { range } = analyticsQueryRange(input.today, input.period);
  const { current, previous } = monthToDateComparison(input.today);
  const thisMonth = sumDaily(input.daily, current);
  const lastMonth = sumDaily(input.daily, previous);
  const periodTotals = sumDaily(input.daily, range);

  const ret = retention(input.cards);
  const medianInterval = medianVisitIntervalDays(input.cards);
  const atRisk = atRiskCards(input.cards, medianInterval, input.now);
  const peak = peakCell(input.heatmap);
  const stampsChange = change(thisMonth.stamps, lastMonth.stamps);
  const effects = broadcastEffects(input.daily, input.broadcasts, range, input.timezone);
  const pending = pendingRewards(input.cards);
  const suggestedDays = suggestedReminderDays(medianInterval);
  const lastBroadcast = input.broadcasts.reduce<number | null>((max, m) => {
    const at = Date.parse(m.created_at);
    return Number.isNaN(at) || (max !== null && max >= at) ? max : at;
  }, null);

  return {
    period: input.period,
    range,
    timezone: input.timezone,
    avgCheck: input.avgCheck,
    comparisonDay: parseLocalDate(input.today).day,
    comparison: {
      stamps: stampsChange,
      newCards: change(thisMonth.newCards, lastMonth.newCards),
      repeatVisits: change(thisMonth.repeatVisits, lastMonth.repeatVisits),
      rewards: change(thisMonth.rewards, lastMonth.rewards),
    },
    periodTotals,
    retention: ret,
    returned30: returnedWithin(input.cards, input.now, 30),
    pendingRewards: pending,
    suggestedReminderDays: suggestedDays,
    medianInterval,
    activeCount: activeCards(input.cards, input.now),
    revenue: programRevenue(periodTotals.repeatVisits, input.avgCheck),
    daily: input.daily
      .filter((row) => row.day >= range.from && row.day <= range.to)
      .map((row) => ({
        label: formatShortDay(row.day),
        newVisits: row.first_visits,
        repeatVisits: row.repeat_visits,
      })),
    heatmap: heatmapMatrix(input.heatmap),
    peak,
    atRisk,
    top: topCards(input.cards, 20),
    effects,
    staff: input.staff,
    insights: insights({
      atRiskCount: atRisk.length,
      peak,
      stampsChange,
      retentionRate: ret.rate,
      avgCheck: input.avgCheck,
      remindersAvailable: input.remindersAvailable,
      remindersEnabled: input.remindersEnabled,
      suggestedReminderDays: suggestedDays,
      pendingRewardCards: pending.cards,
      effects,
      daysSinceBroadcast:
        lastBroadcast === null ? null : Math.floor((input.now.getTime() - lastBroadcast) / 86_400_000),
      totalCards: input.cards.length,
    }),
  };
}
