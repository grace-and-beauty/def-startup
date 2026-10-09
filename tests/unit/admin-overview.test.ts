import { describe, expect, it } from "vitest";

import {
  buildAdminOverview,
  contactLinks,
  monthlyRevenueUah,
  planTag,
  type AdminBusiness,
  type AdminBusinessStats,
} from "@/lib/domain/admin-overview";

const NOW = new Date("2026-10-10T12:00:00Z");
const PERIOD_START = new Date("2026-09-30T21:00:00Z"); // 1 Oct, Kyiv

let seq = 0;
function business(patch: Partial<AdminBusiness> = {}): AdminBusiness {
  seq += 1;
  return {
    id: `b${seq}`,
    name: `Заклад ${seq}`,
    slug: `zaklad-${seq}`,
    niche_slug: "barbershop",
    city: "Рівне",
    contact_phone: "+380671234567",
    plan: "trial",
    billing_status: "active",
    trial_ends_at: "2026-10-30T00:00:00Z",
    plan_renews_at: null,
    canceled_at: null,
    onboarding_done: true,
    created_at: "2026-09-01T10:00:00Z",
    ...patch,
  };
}

function stats(id: string, patch: Partial<AdminBusinessStats> = {}): AdminBusinessStats {
  return {
    business_id: id,
    owner_email: `${id}@example.com`,
    cards_total: 0,
    cards_new: 0,
    cards_new_prev: 0,
    stamps: 0,
    stamps_prev: 0,
    last_stamp_at: null,
    ...patch,
  };
}

describe("plan and revenue", () => {
  it("counts only plans set after payment, with billing active", () => {
    expect(monthlyRevenueUah(business({ plan: "basic" }), NOW)).toBe(199);
    expect(monthlyRevenueUah(business({ plan: "plus" }), NOW)).toBe(449);
    expect(monthlyRevenueUah(business({ plan: "pro" }), NOW)).toBe(799);
    expect(monthlyRevenueUah(business({ plan: "trial" }), NOW)).toBe(0);
    expect(monthlyRevenueUah(business({ plan: "plus", billing_status: "past_due" }), NOW)).toBe(0);
    expect(monthlyRevenueUah(business({ plan: "plus", billing_status: "canceled", canceled_at: NOW.toISOString() }), NOW)).toBe(0);
  });

  it("tells a running trial from one that ran out", () => {
    expect(planTag(business(), NOW)).toBe("trial");
    expect(planTag(business({ trial_ends_at: "2026-10-01T00:00:00Z" }), NOW)).toBe("trial_over");
    expect(planTag(business({ plan: "plus", billing_status: "canceled" }), NOW)).toBe("canceled");
  });
});

describe("buildAdminOverview", () => {
  it("sums businesses, revenue, customers and stamps; skips unfinished sign-ups", () => {
    const old = business({ plan: "plus" });
    const fresh = business({ created_at: "2026-10-05T10:00:00Z", niche_slug: "kavyarnia" });
    const unfinished = business({ onboarding_done: false });
    const overview = buildAdminOverview({
      businesses: [old, fresh, unfinished],
      stats: [
        stats(old.id, { cards_total: 120, cards_new: 10, cards_new_prev: 5, stamps: 80, stamps_prev: 40, last_stamp_at: "2026-10-10T09:00:00Z" }),
        stats(fresh.id, { cards_total: 3, cards_new: 3, stamps: 4, last_stamp_at: "2026-10-09T09:00:00Z" }),
        stats(unfinished.id, { cards_total: 999 }),
      ],
      weeks: [],
      periodStart: PERIOD_START,
      now: NOW,
    });

    expect(overview.businesses).toMatchObject({ current: 2, previous: 1 });
    expect(overview.revenueUah).toMatchObject({ current: 449, previous: 449 });
    expect(overview.paidCount).toBe(1);
    expect(overview.customers).toBe(123);
    expect(overview.newCustomers).toMatchObject({ current: 13, previous: 5 });
    expect(overview.stamps).toEqual({ current: 84, previous: 40, deltaPct: 110 });
    expect(overview.niches).toEqual([
      { slug: "barbershop", count: 1 },
      { slug: "kavyarnia", count: 1 },
    ]);
    expect(overview.plans.plus).toEqual({ count: 1, revenueUah: 449 });
    expect(overview.plans.trial.count).toBe(1);
    expect(overview.rows.map((r) => r.id)).toEqual([old.id, fresh.id]);
    expect(overview.rows[0]).toMatchObject({ email: `${old.id}@example.com`, customers: 120, idleDays: 0, sleeping: false });
  });

  it("marks businesses with no stamp for over 7 days as sleeping", () => {
    const quiet = business({ created_at: "2026-09-01T00:00:00Z" });
    const neverStamped = business({ created_at: "2026-09-20T00:00:00Z" });
    const brandNew = business({ created_at: "2026-10-08T00:00:00Z" });
    const overview = buildAdminOverview({
      businesses: [quiet, neverStamped, brandNew],
      stats: [stats(quiet.id, { last_stamp_at: "2026-10-01T11:00:00Z" })],
      weeks: [],
      periodStart: PERIOD_START,
      now: NOW,
    });
    const byId = Object.fromEntries(overview.rows.map((r) => [r.id, r]));
    expect(byId[quiet.id]).toMatchObject({ idleDays: 9, sleeping: true });
    expect(byId[neverStamped.id]).toMatchObject({ sleeping: true, lastStampAt: null });
    expect(byId[brandNew.id]).toMatchObject({ idleDays: 2, sleeping: false });
  });

  it("lists trials ending within 7 days, soonest first", () => {
    const later = business({ trial_ends_at: "2026-10-16T00:00:00Z" });
    const soon = business({ trial_ends_at: "2026-10-11T00:00:00Z" });
    const far = business({ trial_ends_at: "2026-11-01T00:00:00Z" });
    const overview = buildAdminOverview({
      businesses: [later, soon, far],
      stats: [],
      weeks: [],
      periodStart: PERIOD_START,
      now: NOW,
    });
    expect(overview.trialsEnding.map((r) => r.id)).toEqual([soon.id, later.id]);
  });
});

describe("contactLinks", () => {
  it("builds call, Viber, Telegram and mail links from a stored phone", () => {
    expect(contactLinks("+380671234567", "owner@example.com")).toEqual({
      call: "tel:+380671234567",
      viber: "viber://chat?number=%2B380671234567",
      telegram: "https://t.me/+380671234567",
      email: "mailto:owner@example.com",
    });
  });

  it("gives no phone links for a missing or malformed phone", () => {
    expect(contactLinks(null, null)).toEqual({ call: null, viber: null, telegram: null, email: null });
    expect(contactLinks("+380'><script>", null).call).toBeNull();
    expect(contactLinks(null, "a@b.com?subject=x").email).toBeNull();
  });
});
