/**
 * Pure domain modules added with the dashboard (stage 2b). Stage 4 extends
 * these into the full suite described in docs/plan.md.
 */
import { describe, expect, it } from "vitest";

import type { AnalyticsDailyRow } from "@/lib/data/types";
import {
  atRiskCards,
  broadcastEffects,
  change,
  heatmapMatrix,
  medianVisitIntervalDays,
  peakCell,
  programRevenue,
  repeatShare,
  retention,
  sumDaily,
  topCards,
  type CardStat,
} from "@/lib/domain/analytics";
import { avgCheckSchema } from "@/lib/domain/business-input";
import {
  addDays,
  daysLeft,
  diffDays,
  monthToDateComparison,
  startOfMonth,
  toLocalDate,
  zonedMidnight,
} from "@/lib/domain/dates";
import {
  canIssueCards,
  canStamp,
  effectivePlan,
  getLimit,
  hasFeature,
  isTrialActive,
  remaining,
  type BillingInfo,
} from "@/lib/domain/plans";
import { isValidSlug, normalizeSlugInput, slugCandidates, slugify, transliterate } from "@/lib/domain/slug";
import { checkLogo, isAcceptableLogo, sniffImageType } from "@/lib/security/upload";

const NOW = new Date("2026-10-15T12:00:00Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();
const inDays = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

function billing(patch: Partial<BillingInfo>): BillingInfo {
  return {
    plan: "basic",
    trial_ends_at: ago(1),
    plan_renews_at: null,
    billing_status: "active",
    canceled_at: null,
    ...patch,
  };
}

describe("dates", () => {
  it("local date in a timezone", () => {
    // 22:30 UTC on Oct 14 is already Oct 15 in Kyiv (UTC+3 in summer time).
    expect(toLocalDate(new Date("2026-10-14T22:30:00Z"), "Europe/Kyiv")).toBe("2026-10-15");
    expect(toLocalDate(new Date("2026-10-14T22:30:00Z"), "UTC")).toBe("2026-10-14");
  });

  it("calendar arithmetic", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(diffDays("2026-09-01", "2026-10-01")).toBe(30);
    expect(startOfMonth("2026-10-15")).toBe("2026-10-01");
  });

  it("zoned midnight across DST", () => {
    // Kyiv: UTC+3 in summer, UTC+2 after the last Sunday of October.
    expect(zonedMidnight("2026-10-01", "Europe/Kyiv").toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect(zonedMidnight("2026-11-01", "Europe/Kyiv").toISOString()).toBe("2026-10-31T22:00:00.000Z");
  });

  it("month-to-date comparison clamps to the previous month length", () => {
    expect(monthToDateComparison("2026-10-15")).toEqual({
      current: { from: "2026-10-01", to: "2026-10-15" },
      previous: { from: "2026-09-01", to: "2026-09-15" },
    });
    expect(monthToDateComparison("2026-03-31").previous).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthToDateComparison("2026-01-10").previous).toEqual({ from: "2025-12-01", to: "2025-12-10" });
  });

  it("days left", () => {
    expect(daysLeft(new Date(inDays(2.5)), NOW)).toBe(3);
    expect(daysLeft(new Date(ago(1)), NOW)).toBe(0);
  });
});

describe("plans", () => {
  it("reverse trial: plus while active, basic afterwards", () => {
    expect(effectivePlan(billing({ plan: "trial", trial_ends_at: inDays(5) }), NOW)).toBe("plus");
    expect(effectivePlan(billing({ plan: "trial", trial_ends_at: ago(1) }), NOW)).toBe("basic");
    expect(isTrialActive(billing({ plan: "trial", trial_ends_at: inDays(5) }), NOW)).toBe(true);
  });

  it("past_due keeps the plan for 7 days after plan_renews_at", () => {
    expect(effectivePlan(billing({ plan: "plus", billing_status: "past_due", plan_renews_at: ago(3) }), NOW)).toBe(
      "plus",
    );
    expect(effectivePlan(billing({ plan: "plus", billing_status: "past_due", plan_renews_at: ago(8) }), NOW)).toBe(
      "basic",
    );
  });

  it("canceled: basic for 30 days, then inactive", () => {
    const recent = billing({ plan: "plus", billing_status: "canceled", canceled_at: ago(10) });
    const old = billing({ plan: "plus", billing_status: "canceled", canceled_at: ago(31) });
    expect(effectivePlan(recent, NOW)).toBe("basic");
    expect(canIssueCards(recent, NOW)).toBe(false);
    expect(canStamp(recent, NOW)).toBe(true);
    expect(effectivePlan(old, NOW)).toBe("inactive");
    expect(canStamp(old, NOW)).toBe(false);
    expect(hasFeature(old, "analytics", NOW)).toBe(false);
    expect(getLimit(old, "customers", NOW)).toBe(0);
  });

  it("features and limits", () => {
    const basic = billing({});
    const plus = billing({ plan: "plus" });
    expect(hasFeature(basic, "analytics", NOW)).toBe(false);
    expect(hasFeature(plus, "analytics", NOW)).toBe(true);
    expect(getLimit(basic, "broadcastsPerMonth", NOW)).toBe(2);
    expect(getLimit(plus, "broadcastsPerMonth", NOW)).toBe(Infinity);
    expect(canIssueCards(plus, NOW)).toBe(true);
    expect(remaining(2, 5)).toBe(0);
    expect(remaining(Infinity, 5)).toBe(Infinity);
  });
});

describe("slug", () => {
  it("transliterates Ukrainian (KMU 2010)", () => {
    expect(transliterate("Автомийка")).toBe("avtomyika");
    expect(transliterate("Їжак Юля")).toBe("yizhak yulia");
    expect(transliterate("Згорани")).toBe("zghorany");
    expect(transliterate("Щастя")).toBe("shchastia");
  });

  it("slugify produces valid slugs", () => {
    expect(slugify("Автомийка «Блиск»")).toBe("avtomyika-blysk");
    expect(slugify("Кав'ярня Зерно №1")).toBe("kaviarnia-zerno-1");
    expect(slugify("Знам'янка")).toBe("znamianka");
    expect(slugify("  !!! ")).toBe("");
    const long = slugify("Дуже довга назва закладу, яка точно не влізе в сорок символів");
    expect(long.length).toBeLessThanOrEqual(40);
    expect(isValidSlug(long)).toBe(true);
  });

  it("normalizes manual input and suggests free variants", () => {
    expect(normalizeSlugInput("My Shop_1")).toBe("my-shop-1");
    expect(slugCandidates("blysk", 3)).toEqual(["blysk", "blysk-2", "blysk-3"]);
    for (const c of slugCandidates("a".repeat(40), 3)) expect(isValidSlug(c)).toBe(true);
  });
});

describe("analytics", () => {
  const cards: CardStat[] = [
    // every 7 days, last visit 3 days ago → fine
    { card_id: "a", customer_name: "A", visits: 5, first_visit_at: ago(31), last_visit_at: ago(3), rewards_redeemed: 0 },
    // every 7 days, last visit 30 days ago → at risk (> 7 × 1.5)
    { card_id: "b", customer_name: "B", visits: 3, first_visit_at: ago(44), last_visit_at: ago(30), rewards_redeemed: 0 },
    // one visit only → never at risk
    { card_id: "c", customer_name: null, visits: 1, first_visit_at: ago(60), last_visit_at: ago(60), rewards_redeemed: 0 },
    // no visits
    { card_id: "d", customer_name: "D", visits: 0, first_visit_at: null, last_visit_at: null, rewards_redeemed: 0 },
  ];

  it("retention and median interval", () => {
    expect(retention(cards)).toEqual({ visited: 3, returned: 2, rate: 67 });
    expect(medianVisitIntervalDays(cards)).toBe(7);
    expect(medianVisitIntervalDays([])).toBeNull();
  });

  it("at-risk customers", () => {
    const risk = atRiskCards(cards, 7, NOW);
    expect(risk.map((c) => c.card_id)).toEqual(["b"]);
    expect(risk[0].daysSinceVisit).toBe(30);
    expect(atRiskCards(cards, null, NOW)).toEqual([]);
  });

  it("top customers", () => {
    expect(topCards(cards, 2).map((c) => c.card_id)).toEqual(["a", "b"]);
  });

  const daily: AnalyticsDailyRow[] = [
    { day: "2026-10-01", stamps: 4, first_visits: 1, repeat_visits: 3, rewards: 0, unique_cards: 4, new_cards: 1 },
    { day: "2026-10-02", stamps: 2, first_visits: 0, repeat_visits: 2, rewards: 1, unique_cards: 2, new_cards: 0 },
    { day: "2026-10-03", stamps: 0, first_visits: 0, repeat_visits: 0, rewards: 0, unique_cards: 0, new_cards: 0 },
    { day: "2026-10-04", stamps: 6, first_visits: 2, repeat_visits: 4, rewards: 0, unique_cards: 6, new_cards: 2 },
  ];

  it("daily totals, change and repeat share", () => {
    expect(sumDaily(daily)).toEqual({ stamps: 12, firstVisits: 3, repeatVisits: 9, rewards: 1, newCards: 3 });
    expect(sumDaily(daily, { from: "2026-10-02", to: "2026-10-03" }).stamps).toBe(2);
    expect(change(15, 10)).toEqual({ current: 15, previous: 10, deltaPct: 50 });
    expect(change(3, 0).deltaPct).toBeNull();
    expect(repeatShare({ stamps: 12, repeatVisits: 9 })).toBe(75);
    expect(repeatShare({ stamps: 0, repeatVisits: 0 })).toBeNull();
    expect(programRevenue(9, 350)).toBe(3150);
    expect(programRevenue(9, null)).toBeNull();
  });

  it("broadcast effect: 3-day window vs average 3 days", () => {
    const [effect] = broadcastEffects(
      daily,
      [{ id: "m", text: "x", created_at: "2026-10-01T09:00:00Z" }],
      { from: "2026-10-01", to: "2026-10-04" },
      "Europe/Kyiv",
    );
    // window 10-01…10-03 = 6 visits; baseline 12 / 4 days × 3 = 9
    expect(effect).toMatchObject({ day: "2026-10-01", visitsAfter: 6, baseline: 9, liftPct: -33, partial: false });
  });

  it("heatmap matrix and peak", () => {
    const rows = [
      { dow: 1, hour: 9, stamps: 2 },
      { dow: 6, hour: 18, stamps: 5 },
    ];
    const m = heatmapMatrix(rows);
    expect(m).toHaveLength(7);
    expect(m[5][18]).toBe(5);
    expect(peakCell(rows)).toEqual({ dow: 6, hour: 18, stamps: 5 });
    expect(peakCell([])).toBeNull();
  });
});

describe("owner input", () => {
  it("average check", () => {
    expect(avgCheckSchema.parse("")).toBeNull();
    expect(avgCheckSchema.parse(" 350 ")).toBe(350);
    expect(avgCheckSchema.safeParse("-1").success).toBe(false);
    expect(avgCheckSchema.safeParse("12.5").success).toBe(false);
  });
});

describe("logo upload checks", () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>");

  it("sniffs real image types", () => {
    expect(sniffImageType(png)).toBe("image/png");
    expect(sniffImageType(jpeg)).toBe("image/jpeg");
    expect(sniffImageType(webp)).toBe("image/webp");
    expect(sniffImageType(svg)).toBeNull();
  });

  it("rejects mismatched, empty, oversized and non-image files", () => {
    expect(checkLogo("image/png", png)).toEqual({ ok: true, type: "image/png", extension: "png" });
    expect(checkLogo("image/jpeg", png).ok).toBe(false);
    expect(checkLogo("image/svg+xml", svg).ok).toBe(false);
    expect(checkLogo("image/png", new Uint8Array()).ok).toBe(false);
    expect(isAcceptableLogo({ type: "image/png", size: 2 * 1024 * 1024 })).toBe(false);
    expect(isAcceptableLogo({ type: "image/gif", size: 10 })).toBe(false);
  });
});
