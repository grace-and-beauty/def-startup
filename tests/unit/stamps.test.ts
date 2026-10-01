import { describe, expect, it } from "vitest";

import {
  applyStamp,
  cardStateFromRow,
  cooldownEndsAt,
  isValidStampsRequired,
  redeemReward,
  stampsUntilReward,
  type StampCardState,
} from "@/lib/domain/stamps";

const NOW = new Date("2026-10-01T12:00:00Z");
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

const fresh = (patch: Partial<StampCardState> = {}): StampCardState => ({
  stampsCount: 0,
  rewardsAvailable: 0,
  rewardsRedeemed: 0,
  totalVisits: 0,
  firstVisitAt: null,
  lastVisitAt: null,
  ...patch,
});

describe("applyStamp", () => {
  it("adds a stamp and records the visit", () => {
    const result = applyStamp(fresh(), { stampsRequired: 6 }, NOW);
    expect(result).toEqual({
      ok: true,
      rewardsEarned: 0,
      card: fresh({ stampsCount: 1, totalVisits: 1, firstVisitAt: NOW, lastVisitAt: NOW }),
    });
  });

  it("keeps the first visit date", () => {
    const first = minutes(-60 * 24);
    const result = applyStamp(fresh({ stampsCount: 2, totalVisits: 2, firstVisitAt: first, lastVisitAt: minutes(-60) }), { stampsRequired: 6 }, NOW);
    expect(result.ok && result.card.firstVisitAt).toEqual(first);
  });

  it("refuses a second stamp within the cooldown and says when to retry", () => {
    const card = fresh({ stampsCount: 1, totalVisits: 1, firstVisitAt: minutes(-3), lastVisitAt: minutes(-3) });
    expect(applyStamp(card, { stampsRequired: 6 }, NOW, 10)).toEqual({
      ok: false,
      reason: "cooldown",
      retryAfter: minutes(7),
    });
  });

  it("allows a stamp exactly when the cooldown ends (same rule as the RPC)", () => {
    const card = fresh({ stampsCount: 1, totalVisits: 1, lastVisitAt: minutes(-10) });
    expect(applyStamp(card, { stampsRequired: 6 }, NOW, 10).ok).toBe(true);
    expect(cooldownEndsAt(card, 10, NOW)).toBeNull();
  });

  it("cooldown 0 disables the check", () => {
    const card = fresh({ stampsCount: 1, totalVisits: 1, lastVisitAt: NOW });
    expect(applyStamp(card, { stampsRequired: 6 }, NOW, 0).ok).toBe(true);
    expect(cooldownEndsAt(card, 0, NOW)).toBeNull();
    expect(cooldownEndsAt(card, Number.NaN, NOW)).toBeNull();
  });

  it("fills the card → reward, stamps roll over to 0", () => {
    const result = applyStamp(fresh({ stampsCount: 5, totalVisits: 5, lastVisitAt: minutes(-60) }), { stampsRequired: 6 }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rewardsEarned).toBe(1);
    expect(result.card.stampsCount).toBe(0);
    expect(result.card.rewardsAvailable).toBe(1);
    expect(result.card.totalVisits).toBe(6);
  });

  it("normalizes a card above a lowered stamps_required", () => {
    // 7 stamps collected under the old rule (10), rule lowered to 4: 8 → 2 rewards, 0 left.
    const result = applyStamp(fresh({ stampsCount: 7, rewardsAvailable: 1 }), { stampsRequired: 4 }, NOW);
    expect(result.ok && result.card).toMatchObject({ stampsCount: 0, rewardsAvailable: 3 });
    expect(result.ok && result.rewardsEarned).toBe(2);
  });

  it("accepts stamps_required 2 and 20, rejects outside the bounds", () => {
    expect(applyStamp(fresh({ stampsCount: 1 }), { stampsRequired: 2 }, NOW)).toMatchObject({ ok: true, rewardsEarned: 1 });
    expect(applyStamp(fresh({ stampsCount: 19 }), { stampsRequired: 20 }, NOW)).toMatchObject({ ok: true, rewardsEarned: 1 });
    expect(applyStamp(fresh({ stampsCount: 18 }), { stampsRequired: 20 }, NOW)).toMatchObject({ ok: true, rewardsEarned: 0 });
    expect(() => applyStamp(fresh(), { stampsRequired: 1 }, NOW)).toThrow(RangeError);
    expect(() => applyStamp(fresh(), { stampsRequired: 21 }, NOW)).toThrow(RangeError);
    expect(() => applyStamp(fresh(), { stampsRequired: 2.5 }, NOW)).toThrow(RangeError);
    expect(isValidStampsRequired(2)).toBe(true);
    expect(isValidStampsRequired(20)).toBe(true);
    expect(isValidStampsRequired(0)).toBe(false);
  });

  it("is pure: the input card is not modified", () => {
    const card = fresh({ stampsCount: 5 });
    const copy = { ...card };
    applyStamp(card, { stampsRequired: 6 }, NOW);
    expect(card).toEqual(copy);
  });
});

describe("redeemReward", () => {
  it("fails without available rewards", () => {
    expect(redeemReward(fresh())).toEqual({ ok: false, reason: "no_reward" });
    expect(redeemReward(fresh({ rewardsAvailable: -1 }))).toEqual({ ok: false, reason: "no_reward" });
  });

  it("moves one reward from available to redeemed and keeps the stamps", () => {
    const result = redeemReward(fresh({ stampsCount: 2, rewardsAvailable: 2, rewardsRedeemed: 1, totalVisits: 14 }));
    expect(result).toEqual({
      ok: true,
      card: fresh({ stampsCount: 2, rewardsAvailable: 1, rewardsRedeemed: 2, totalVisits: 14 }),
    });
  });
});

describe("helpers", () => {
  it("stampsUntilReward", () => {
    expect(stampsUntilReward({ stampsCount: 0 }, { stampsRequired: 6 })).toBe(6);
    expect(stampsUntilReward({ stampsCount: 5 }, { stampsRequired: 6 })).toBe(1);
  });

  it("cardStateFromRow maps DB rows", () => {
    expect(
      cardStateFromRow({
        stamps_count: 3,
        rewards_available: 1,
        rewards_redeemed: 2,
        total_visits: 9,
        first_visit_at: "2026-09-01T10:00:00Z",
        last_visit_at: null,
      }),
    ).toEqual({
      stampsCount: 3,
      rewardsAvailable: 1,
      rewardsRedeemed: 2,
      totalVisits: 9,
      firstVisitAt: new Date("2026-09-01T10:00:00Z"),
      lastVisitAt: null,
    });
  });
});
