import { describe, expect, it } from "vitest";

import { FEATURES, PLAN_IDS, PLANS } from "@/config/plans";
import { listNiches, NICHE_SLUGS, NICHES } from "@/config/niches";
import { interpolate, t } from "@/lib/i18n";

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("niches config", () => {
  it("has the 8 MVP niches", () => {
    expect(NICHE_SLUGS).toHaveLength(8);
    expect(listNiches()[0]?.slug).toBe("avtomyika");
  });

  it.each(NICHE_SLUGS)("%s satisfies DB constraints", (slug) => {
    const n = NICHES[slug];
    expect(n.slug).toBe(slug);
    expect(n.stampsRequired).toBeGreaterThanOrEqual(2);
    expect(n.stampsRequired).toBeLessThanOrEqual(20);
    expect(n.rewardText.length).toBeLessThanOrEqual(120);
    expect(n.reminderText === null || n.reminderText.length <= 120).toBe(true);
    expect((n.reminderDays === null) === (n.reminderText === null)).toBe(true);
    expect([n.colors.bg, n.colors.fg, n.colors.label].every((c) => HEX.test(c))).toBe(true);
    expect(n.landing.pains.length).toBeGreaterThan(0);
  });
});

describe("plans config", () => {
  it("matches architecture §6.1", () => {
    expect(PLAN_IDS).toEqual(["basic", "plus", "pro"]);
    expect(PLANS.basic.limits).toEqual({ customers: 300, broadcastsPerMonth: 2, staff: 1 });
    expect(PLANS.plus.features).toEqual(["analytics", "reminders", "staff_pins", "unlimited_broadcasts"]);
    expect(PLANS.plus.limits.customers).toBe(2000);
    expect(PLANS.pro.features).toEqual(FEATURES);
  });
});

describe("i18n", () => {
  it("translates and interpolates", () => {
    expect(t("plans.plus.name")).toBe("Плюс");
    expect(t("home.title", { brand: "X" })).toContain("X");
    expect(interpolate("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});
