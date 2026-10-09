/**
 * Numbers of the service admin dashboard (/admin), from all businesses and
 * their per-business stats (RPC admin_business_stats / admin_weekly_growth).
 * Pure: the page loads the rows, this turns them into what is shown.
 */
import { PLAN_IDS, PLANS, type PlanId } from "@/config/plans";

import { change, type Change } from "./analytics";
import { isTrialActive } from "./plans";

/** A business is "asleep" after this many days without a stamp. */
export const SLEEPING_AFTER_DAYS = 7;
/** Trials ending within this many days are listed (time to call the owner). */
export const TRIAL_ENDING_WITHIN_DAYS = 7;

const DAY_MS = 86_400_000;

export interface AdminBusiness {
  id: string;
  name: string;
  slug: string;
  niche_slug: string;
  city: string | null;
  contact_phone: string | null;
  plan: "trial" | PlanId;
  billing_status: "active" | "past_due" | "canceled";
  trial_ends_at: string;
  plan_renews_at: string | null;
  canceled_at: string | null;
  onboarding_done: boolean;
  created_at: string;
}

export interface AdminBusinessStats {
  business_id: string;
  owner_email: string | null;
  cards_total: number;
  cards_new: number;
  cards_new_prev: number;
  stamps: number;
  stamps_prev: number;
  last_stamp_at: string | null;
}

export interface AdminWeek {
  week_start: string;
  new_businesses: number;
  new_cards: number;
}

/** What the table shows for a business; "trial_over" = trial ended, nothing paid. */
export type AdminPlanTag = "trial" | "trial_over" | "canceled" | PlanId;

export interface AdminRow {
  id: string;
  name: string;
  slug: string;
  nicheSlug: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  plan: AdminPlanTag;
  /** UAH per month this business brings (0 unless a paid plan is active). */
  monthlyUah: number;
  customers: number;
  stampsThisPeriod: number;
  lastStampAt: string | null;
  /** Whole days since the last stamp (or since sign-up, without stamps). */
  idleDays: number;
  sleeping: boolean;
  trialEndsAt: string | null;
  createdAt: string;
}

export interface AdminOverview {
  businesses: Change;
  revenueUah: Change;
  paidCount: number;
  customers: number;
  newCustomers: Change;
  stamps: Change;
  niches: { slug: string; count: number }[];
  plans: Record<"trial" | "trial_over" | "canceled" | PlanId, { count: number; revenueUah: number }>;
  trialsEnding: AdminRow[];
  weeks: AdminWeek[];
  rows: AdminRow[];
}

function time(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Paid = a plan the admin set by hand after an invoice was paid, billing
 * active. A trial that simply ran out is not revenue.
 */
export function planTag(business: AdminBusiness, now: Date): AdminPlanTag {
  if (business.billing_status === "canceled") return "canceled";
  if (business.plan === "trial") return isTrialActive(business, now) ? "trial" : "trial_over";
  return business.plan;
}

export function monthlyRevenueUah(business: AdminBusiness, now: Date): number {
  const tag = planTag(business, now);
  return business.billing_status === "active" && (PLAN_IDS as readonly string[]).includes(tag)
    ? PLANS[tag as PlanId].priceUah
    : 0;
}

export function buildAdminOverview(input: {
  businesses: readonly AdminBusiness[];
  stats: readonly AdminBusinessStats[];
  weeks: readonly AdminWeek[];
  /** Start of the current comparison period (month to date). */
  periodStart: Date;
  now: Date;
}): AdminOverview {
  const { now } = input;
  const statsById = new Map(input.stats.map((s) => [s.business_id, s]));
  // Businesses that never finished the wizard have no card yet: not shown.
  const live = input.businesses.filter((b) => b.onboarding_done);

  const rows: AdminRow[] = live.map((b) => {
    const s = statsById.get(b.id);
    const lastStamp = time(s?.last_stamp_at ?? null);
    const since = lastStamp ?? time(b.created_at) ?? now.getTime();
    const idleDays = Math.max(0, Math.floor((now.getTime() - since) / DAY_MS));
    const plan = planTag(b, now);
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      nicheSlug: b.niche_slug,
      city: b.city,
      phone: b.contact_phone,
      email: s?.owner_email ?? null,
      plan,
      monthlyUah: monthlyRevenueUah(b, now),
      customers: s?.cards_total ?? 0,
      stampsThisPeriod: s?.stamps ?? 0,
      lastStampAt: s?.last_stamp_at ?? null,
      idleDays,
      sleeping: idleDays > SLEEPING_AFTER_DAYS,
      trialEndsAt: b.plan === "trial" ? b.trial_ends_at : null,
      createdAt: b.created_at,
    };
  });

  const sum = (pick: (s: AdminBusinessStats) => number) =>
    live.reduce((total, b) => total + (statsById.has(b.id) ? pick(statsById.get(b.id)!) : 0), 0);

  const createdIn = (from: Date, to: Date) =>
    live.filter((b) => {
      const t = time(b.created_at);
      return t !== null && t >= from.getTime() && t < to.getTime();
    }).length;

  // Revenue a month ago: plans are not versioned, so "previous" = businesses
  // that already existed then with today's plan — good enough for a trend.
  const revenueNow = rows.reduce((total, r) => total + r.monthlyUah, 0);
  const revenuePrev = rows
    .filter((r) => (time(r.createdAt) ?? 0) < input.periodStart.getTime())
    .reduce((total, r) => total + r.monthlyUah, 0);

  const nicheCounts = new Map<string, number>();
  for (const b of live) nicheCounts.set(b.niche_slug, (nicheCounts.get(b.niche_slug) ?? 0) + 1);

  const plans: AdminOverview["plans"] = {
    trial: { count: 0, revenueUah: 0 },
    trial_over: { count: 0, revenueUah: 0 },
    canceled: { count: 0, revenueUah: 0 },
    basic: { count: 0, revenueUah: 0 },
    plus: { count: 0, revenueUah: 0 },
    pro: { count: 0, revenueUah: 0 },
  };
  for (const r of rows) {
    plans[r.plan].count += 1;
    plans[r.plan].revenueUah += r.monthlyUah;
  }

  const endingBefore = now.getTime() + TRIAL_ENDING_WITHIN_DAYS * DAY_MS;
  const trialsEnding = rows
    .filter((r) => r.plan === "trial" && (time(r.trialEndsAt) ?? Infinity) <= endingBefore)
    .sort((a, b) => (time(a.trialEndsAt) ?? 0) - (time(b.trialEndsAt) ?? 0));

  return {
    businesses: change(live.length, live.length - createdIn(input.periodStart, now)),
    revenueUah: change(revenueNow, revenuePrev),
    paidCount: rows.filter((r) => r.monthlyUah > 0).length,
    customers: sum((s) => s.cards_total),
    newCustomers: change(sum((s) => s.cards_new), sum((s) => s.cards_new_prev)),
    stamps: change(sum((s) => s.stamps), sum((s) => s.stamps_prev)),
    niches: [...nicheCounts.entries()]
      .map(([slug, count]) => ({ slug, count }))
      .sort((a, b) => b.count - a.count || a.slug.localeCompare(b.slug)),
    plans,
    trialsEnding,
    weeks: [...input.weeks],
    rows: rows.sort((a, b) => b.stampsThisPeriod - a.stampsThisPeriod || a.name.localeCompare(b.name, "uk")),
  };
}

/**
 * Links to reach an owner. The phone is stored as "+380XXXXXXXXX"
 * (CHECK on businesses.contact_phone), so it is safe in a URL as is.
 */
export function contactLinks(phone: string | null, email: string | null) {
  const digits = phone && /^\+380\d{9}$/.test(phone) ? phone.slice(1) : null;
  return {
    call: digits ? `tel:+${digits}` : null,
    viber: digits ? `viber://chat?number=%2B${digits}` : null,
    telegram: digits ? `https://t.me/+${digits}` : null,
    // Auth emails are already validated; anything URL-special is refused anyway.
    email: email && /^[^\s@?&#/:]+@[^\s@?&#/:]+$/.test(email) ? `mailto:${email}` : null,
  };
}
