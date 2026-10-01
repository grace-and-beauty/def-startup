/**
 * Deterministic demo data for the blurred analytics preview on the Basic
 * plan — the owner's real numbers are never rendered there.
 */
import type {
  AnalyticsCardStatsRow,
  AnalyticsDailyRow,
  AnalyticsHeatmapRow,
  AnalyticsStaffRow,
} from "@/lib/data";
import { addDays, diffDays, type LocalDate } from "@/lib/domain/dates";

import type { AnalyticsInputs, Period } from "./model";

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = ["Олександр", "Марія", "Дмитро", "Олена", "Андрій", "Ірина", "Сергій", "Наталія", "Максим", "Юлія"];

export function sampleAnalyticsInputs(today: LocalDate, period: Period, now: Date): AnalyticsInputs {
  const random = rng(42);
  const from = addDays(today, -95);
  const daily: AnalyticsDailyRow[] = [];
  for (let i = 0; i <= diffDays(from, today); i++) {
    const day = addDays(from, i);
    const stamps = 3 + Math.floor(random() * 9);
    const first = Math.floor(stamps * (0.15 + random() * 0.2));
    daily.push({
      day,
      stamps,
      first_visits: first,
      repeat_visits: stamps - first,
      rewards: random() > 0.7 ? 1 : 0,
      unique_cards: stamps,
      new_cards: first,
    });
  }

  const heatmap: AnalyticsHeatmapRow[] = [];
  for (let dow = 1; dow <= 7; dow++) {
    for (let hour = 9; hour <= 20; hour++) {
      const weekend = dow >= 6 ? 1.6 : 1;
      const lunch = hour >= 12 && hour <= 14 ? 1.5 : 1;
      const evening = hour >= 17 && hour <= 19 ? 1.8 : 1;
      heatmap.push({ dow, hour, stamps: Math.round(random() * 4 * weekend * lunch * evening) });
    }
  }

  const cards: AnalyticsCardStatsRow[] = Array.from({ length: 30 }, (_, i) => {
    const visits = 1 + Math.floor(random() * 12);
    const lastDaysAgo = Math.floor(random() * 50);
    const last = new Date(now.getTime() - lastDaysAgo * 86_400_000);
    const first = new Date(last.getTime() - visits * (5 + random() * 10) * 86_400_000);
    return {
      card_id: `sample-${i}`,
      customer_id: `sample-customer-${i}`,
      customer_name: NAMES[i % NAMES.length],
      card_created_at: first.toISOString(),
      visits,
      rewards_redeemed: Math.floor(visits / 6),
      first_visit_at: first.toISOString(),
      last_visit_at: last.toISOString(),
      last_reminder_at: null,
      stamps_count: visits % 6,
      rewards_available: 0,
      wallet_type: "web",
    };
  });

  const staff: AnalyticsStaffRow[] = [
    { staff_id: "sample-staff-1", staff_name: "Загальний", is_active: true, stamps: 120, rewards: 14, unique_cards: 26 },
    { staff_id: "sample-staff-2", staff_name: "Андрій", is_active: true, stamps: 84, rewards: 9, unique_cards: 19 },
  ];

  return {
    today,
    period,
    timezone: "Europe/Kyiv",
    avgCheck: 350,
    now,
    daily,
    heatmap,
    cards,
    staff,
    broadcasts: [
      {
        id: "sample-message",
        text: "Цього тижня — знижка 20%",
        created_at: new Date(now.getTime() - 12 * 86_400_000).toISOString(),
      },
    ],
  };
}
