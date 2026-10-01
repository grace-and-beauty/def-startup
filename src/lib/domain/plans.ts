/**
 * Effective plan, features and limits (docs/architecture.md §6.2) — the ONLY
 * place that interprets billing fields. Pure functions; used by Server
 * Actions and by the UI alike.
 *
 *  - trial and now < trial_ends_at            → plus (reverse trial)
 *  - trial after trial_ends_at                → basic
 *  - past_due > 7 days after plan_renews_at   → basic
 *  - canceled: basic until canceled_at + 30d  → then inactive
 *    (new cards are refused right after cancellation; existing cards and the
 *    scanner keep working during those 30 days — PRD §6)
 */
import {
  CANCELED_GRACE_DAYS,
  FALLBACK_PLAN,
  PAST_DUE_GRACE_DAYS,
  PLANS,
  TRIAL_PLAN,
  type Feature,
  type PlanId,
  type PlanLimits,
} from "@/config/plans";
import type { BillingStatus, StoredPlanValue } from "@/lib/data/types";

export type EffectivePlan = PlanId | "inactive";

/** Billing fields of businesses (a full row or BusinessPublic both fit). */
export interface BillingInfo {
  plan: StoredPlanValue;
  trial_ends_at: string;
  plan_renews_at: string | null;
  billing_status: BillingStatus;
  canceled_at: string | null;
}

const DAY_MS = 86_400_000;

function time(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function effectivePlan(business: BillingInfo, now: Date): EffectivePlan {
  const at = now.getTime();

  if (business.billing_status === "canceled") {
    // A canceled business without a timestamp is treated as canceled "now".
    const canceledAt = time(business.canceled_at) ?? at;
    return at < canceledAt + CANCELED_GRACE_DAYS * DAY_MS ? FALLBACK_PLAN : "inactive";
  }

  if (business.plan === "trial") {
    const trialEnds = time(business.trial_ends_at);
    return trialEnds !== null && at < trialEnds ? TRIAL_PLAN : FALLBACK_PLAN;
  }

  if (business.billing_status === "past_due") {
    const renews = time(business.plan_renews_at);
    if (renews === null || at > renews + PAST_DUE_GRACE_DAYS * DAY_MS) return FALLBACK_PLAN;
  }

  return business.plan;
}

/** Trial is running (shown as a banner with the end date). */
export function isTrialActive(business: BillingInfo, now: Date): boolean {
  return (
    business.plan === "trial" &&
    business.billing_status !== "canceled" &&
    (time(business.trial_ends_at) ?? 0) > now.getTime()
  );
}

export function hasFeature(business: BillingInfo, feature: Feature, now: Date): boolean {
  const plan = effectivePlan(business, now);
  if (plan === "inactive") return false;
  return PLANS[plan].features.includes(feature);
}

const INACTIVE_LIMITS: PlanLimits = { customers: 0, broadcastsPerMonth: 0, staff: 0 };

export function getLimits(business: BillingInfo, now: Date): PlanLimits {
  const plan = effectivePlan(business, now);
  return plan === "inactive" ? INACTIVE_LIMITS : PLANS[plan].limits;
}

export function getLimit(business: BillingInfo, limit: keyof PlanLimits, now: Date): number {
  return getLimits(business, now)[limit];
}

/** New cards on /c/[slug]: refused once canceled and when inactive. */
export function canIssueCards(business: BillingInfo, now: Date): boolean {
  return business.billing_status !== "canceled" && effectivePlan(business, now) !== "inactive";
}

/** Stamps / rewards at the scanner: allowed until the business is inactive. */
export function canStamp(business: BillingInfo, now: Date): boolean {
  return effectivePlan(business, now) !== "inactive";
}

/** Remaining quota (Infinity stays Infinity, never negative). */
export function remaining(limit: number, used: number): number {
  return Number.isFinite(limit) ? Math.max(0, limit - used) : Infinity;
}
