/**
 * Stage 3b domain logic: reminders, plan-limited staff PINs, extra analytics
 * metrics and hints, cron authorization.
 */
import { describe, expect, it } from "vitest";

import {
  change,
  insightAction,
  insights,
  pendingRewards,
  returnedWithin,
  suggestedReminderDays,
} from "@/lib/domain/analytics";
import { scannerStaffLimit, usableStaff, type BillingInfo } from "@/lib/domain/plans";
import {
  isDueForReminder,
  reminderCutoff,
  reminderSettings,
  selectCardsToRemind,
} from "@/lib/domain/reminders";
import { isAuthorizedCronRequest } from "@/lib/security/cron";

const NOW = new Date("2026-10-15T08:00:00Z");
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

const plan = (overrides: Partial<BillingInfo>): BillingInfo => ({
  plan: "plus",
  trial_ends_at: ago(60),
  plan_renews_at: null,
  billing_status: "active",
  canceled_at: null,
  ...overrides,
});

describe("reminders", () => {
  const program = { reminders_enabled: true, reminder_days: 14, reminder_text: "  Час на мийку!  " };

  it("settings need the switch, a valid day count and a text", () => {
    expect(reminderSettings(program)).toEqual({ days: 14, text: "Час на мийку!" });
    expect(reminderSettings({ ...program, reminders_enabled: false })).toBeNull();
    expect(reminderSettings({ ...program, reminder_days: null })).toBeNull();
    expect(reminderSettings({ ...program, reminder_days: 0 })).toBeNull();
    expect(reminderSettings({ ...program, reminder_text: "   " })).toBeNull();
  });

  it("day boundary: exactly N days after the last visit is due, a minute less is not", () => {
    const exact = { last_visit_at: ago(14), last_reminder_at: null };
    const almost = { last_visit_at: new Date(NOW.getTime() - 14 * DAY + 60_000).toISOString(), last_reminder_at: null };
    expect(isDueForReminder(exact, 14, NOW)).toBe(true);
    expect(isDueForReminder(almost, 14, NOW)).toBe(false);
  });

  it("one reminder per absence; a new visit re-arms it; no visit → never", () => {
    expect(isDueForReminder({ last_visit_at: ago(20), last_reminder_at: ago(5) }, 14, NOW)).toBe(false);
    expect(isDueForReminder({ last_visit_at: ago(20), last_reminder_at: ago(40) }, 14, NOW)).toBe(true);
    expect(isDueForReminder({ last_visit_at: null, last_reminder_at: null }, 14, NOW)).toBe(false);
  });

  it("selects only due cards, nothing when reminders are off", () => {
    const cards = [
      { id: "due", last_visit_at: ago(30), last_reminder_at: null },
      { id: "recent", last_visit_at: ago(3), last_reminder_at: null },
      { id: "reminded", last_visit_at: ago(30), last_reminder_at: ago(10) },
    ];
    expect(selectCardsToRemind(cards, program, NOW).map((c) => c.id)).toEqual(["due"]);
    expect(selectCardsToRemind(cards, { ...program, reminders_enabled: false }, NOW)).toEqual([]);
    expect(reminderCutoff(14, NOW).toISOString()).toBe(ago(14));
  });
});

describe("plans: staff PINs at the scanner", () => {
  const staff = [
    { id: "s3", is_active: true, created_at: ago(1) },
    { id: "s1", is_active: true, created_at: ago(30) },
    { id: "s2", is_active: false, created_at: ago(20) },
    { id: "s4", is_active: true, created_at: ago(10) },
  ];

  it("Plus / trial: every active PIN up to the plan limit", () => {
    expect(scannerStaffLimit(plan({}), NOW)).toBe(20);
    expect(usableStaff(staff, plan({}), NOW).map((s) => s.id)).toEqual(["s1", "s4", "s3"]);
    const trial = plan({ plan: "trial", trial_ends_at: ago(-5) });
    expect(usableStaff(staff, trial, NOW)).toHaveLength(3);
  });

  it("Basic (also after the trial): only the first-created active PIN", () => {
    expect(usableStaff(staff, plan({ plan: "basic" }), NOW).map((s) => s.id)).toEqual(["s1"]);
    expect(usableStaff(staff, plan({ plan: "trial", trial_ends_at: ago(1) }), NOW).map((s) => s.id)).toEqual(["s1"]);
  });

  it("inactive business keeps one PIN for read-only scanner access", () => {
    const inactive = plan({ billing_status: "canceled", canceled_at: ago(45) });
    expect(scannerStaffLimit(inactive, NOW)).toBe(1);
    expect(usableStaff(staff, inactive, NOW).map((s) => s.id)).toEqual(["s1"]);
  });
});

describe("analytics: extra metrics and hints", () => {
  it("returned within 30 days only judges cards whose first visit is ≥ 30 days old", () => {
    const base = { customer_name: null, rewards_redeemed: 0, last_visit_at: ago(1) };
    const result = returnedWithin(
      [
        { ...base, card_id: "a", visits: 3, first_visit_at: ago(60), second_visit_at: ago(50) }, // back in 10 d
        { ...base, card_id: "b", visits: 2, first_visit_at: ago(90), second_visit_at: ago(40) }, // back in 50 d
        { ...base, card_id: "c", visits: 1, first_visit_at: ago(45), second_visit_at: null }, // never
        { ...base, card_id: "d", visits: 2, first_visit_at: ago(10), second_visit_at: ago(5) }, // too young
        { ...base, card_id: "e", visits: 0, first_visit_at: null, second_visit_at: null },
      ],
      NOW,
    );
    expect(result).toEqual({ cohort: 3, returned: 1, rate: 33 });
    expect(returnedWithin([], NOW).rate).toBeNull();
  });

  it("pending rewards and suggested reminder delay", () => {
    expect(pendingRewards([{ rewards_available: 2 }, { rewards_available: 0 }, { rewards_available: 1 }])).toEqual({
      cards: 2,
      rewards: 3,
    });
    expect(suggestedReminderDays(7)).toBe(11);
    expect(suggestedReminderDays(0.2)).toBe(1);
    expect(suggestedReminderDays(null)).toBeNull();
  });

  it("hints come with actions", () => {
    const list = insights({
      atRiskCount: 4,
      peak: { dow: 6, hour: 18, stamps: 9 },
      stampsChange: change(70, 100),
      retentionRate: 20,
      avgCheck: null,
      remindersAvailable: true,
      remindersEnabled: false,
      suggestedReminderDays: 11,
      pendingRewardCards: 2,
      effects: [
        { liftPct: 35, partial: false },
        { liftPct: 90, partial: true },
      ],
      daysSinceBroadcast: 45,
      totalCards: 40,
    });
    expect(list.map((i) => i.kind)).toEqual([
      "atRisk",
      "remindersOff",
      "pendingRewards",
      "decline",
      "lowRetention",
      "broadcastWorked",
      "noRecentBroadcast",
      "peak",
      "noAvgCheck",
    ]);
    expect(list.find((i) => i.kind === "broadcastWorked")).toEqual({ kind: "broadcastWorked", pct: 35 });
    expect(list.map(insightAction)).toEqual([
      "broadcastAtRisk",
      "reminders",
      "broadcast",
      "broadcast",
      "reminders",
      "broadcast",
      "broadcast",
      null,
      "avgCheck",
    ]);
  });

  it("no reminder / broadcast nags when they are on, recent or impossible", () => {
    const list = insights({
      atRiskCount: 1,
      peak: null,
      stampsChange: change(10, 10),
      retentionRate: 60,
      avgCheck: 300,
      remindersAvailable: true,
      remindersEnabled: true,
      daysSinceBroadcast: 3,
      totalCards: 10,
    });
    expect(list.map((i) => i.kind)).toEqual(["atRisk"]);
    expect(
      insights({ atRiskCount: 0, peak: null, stampsChange: change(0, 0), retentionRate: null, avgCheck: 1, daysSinceBroadcast: null, totalCards: 0 }),
    ).toEqual([]);
  });
});

describe("cron authorization", () => {
  it("accepts only the exact bearer token and refuses without a secret", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret-value", "s3cret-value")).toBe(true);
    expect(isAuthorizedCronRequest("Bearer wrong", "s3cret-value")).toBe(false);
    expect(isAuthorizedCronRequest("s3cret-value", "s3cret-value")).toBe(false);
    expect(isAuthorizedCronRequest(null, "s3cret-value")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer ", undefined)).toBe(false);
  });
});
