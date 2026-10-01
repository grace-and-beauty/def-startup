/**
 * Plans → features → limits (docs/architecture.md §6.1, PRD §6).
 *
 * Do not check plan ids directly in UI / actions: use
 * src/lib/domain/plans.ts (effectivePlan / hasFeature / getLimit) — it applies
 * trial, grace periods and cancellation on top of this table.
 */

export const FEATURES = [
  "analytics",
  "reminders",
  "staff_pins",
  "unlimited_broadcasts",
  "bonuses",
  "birthday",
  "referrals",
  "reviews",
  "multi_location",
  "csv_export",
] as const;

export type Feature = (typeof FEATURES)[number];

export interface PlanLimits {
  /** Max customers (cards) — new cards are refused beyond this. */
  customers: number;
  /** Broadcasts per calendar month in the business timezone. */
  broadcastsPerMonth: number;
  /** Max staff members (incl. the default «Загальний»). */
  staff: number;
}

/** Plans that can be sold. `trial` is a billing state, not a sellable plan. */
export const PLAN_IDS = ["basic", "plus", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

/** Value of businesses.plan in the database. */
export const STORED_PLANS = ["trial", ...PLAN_IDS] as const;
export type StoredPlan = (typeof STORED_PLANS)[number];

export interface PlanConfig {
  id: PlanId;
  /** i18n key of the plan name, e.g. t("plans.basic.name"). */
  nameKey: `plans.${PlanId}.name`;
  /** Monthly price, UAH. */
  priceUah: number;
  features: readonly Feature[];
  limits: PlanLimits;
  /** Available to buy in the MVP (pro modules are post-MVP). */
  availableInMvp: boolean;
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  basic: {
    id: "basic",
    nameKey: "plans.basic.name",
    priceUah: 199,
    features: [],
    limits: { customers: 300, broadcastsPerMonth: 2, staff: 1 },
    availableInMvp: true,
  },
  plus: {
    id: "plus",
    nameKey: "plans.plus.name",
    priceUah: 449,
    features: ["analytics", "reminders", "staff_pins", "unlimited_broadcasts"],
    limits: { customers: 2000, broadcastsPerMonth: Infinity, staff: 20 },
    availableInMvp: true,
    highlighted: true,
  },
  pro: {
    id: "pro",
    nameKey: "plans.pro.name",
    priceUah: 799,
    features: FEATURES,
    limits: { customers: Infinity, broadcastsPerMonth: Infinity, staff: 50 },
    availableInMvp: false,
  },
};

/** Plan granted during the reverse trial. */
export const TRIAL_PLAN: PlanId = "plus";
export const TRIAL_DAYS = 30;
/** Plan a business falls back to after trial / non-payment / cancellation. */
export const FALLBACK_PLAN: PlanId = "basic";
/** past_due: days after plan_renews_at before falling back to FALLBACK_PLAN. */
export const PAST_DUE_GRACE_DAYS = 7;
/** canceled: days existing cards keep working before the business is inactive. */
export const CANCELED_GRACE_DAYS = 30;
