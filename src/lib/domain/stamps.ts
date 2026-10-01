/**
 * Stamp / reward rules (docs/architecture.md §5.2). Pure functions, no I/O.
 *
 * The RPCs apply_stamp / redeem_reward (supabase/migrations/*_rpc_stamps.sql)
 * implement the SAME rules inside one transaction with a row lock and are the
 * source of truth for writes. Server Actions use these functions to answer
 * early (cooldown, nothing to redeem) without taking the lock, and the UI uses
 * them to show progress. tests/integration/stamps-parity.test.ts checks that
 * both implementations agree.
 *
 * Rules:
 *  - one stamp per card per cooldown (STAMP_COOLDOWN_MINUTES, default 10;
 *    0 disables the cooldown);
 *  - every stamp is a visit: total_visits + 1, first/last visit updated;
 *  - when stamps reach stamps_required, the card rolls over: stamps_count
 *    becomes the remainder and rewards_available grows by the number of full
 *    rounds (a stamps_count above a lowered stamps_required is normalized);
 *  - a reward can be redeemed only while rewards_available > 0.
 */

export const STAMPS_REQUIRED_MIN = 2;
export const STAMPS_REQUIRED_MAX = 20;
export const DEFAULT_STAMP_COOLDOWN_MINUTES = 10;

export interface StampCardState {
  stampsCount: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  totalVisits: number;
  firstVisitAt: Date | null;
  lastVisitAt: Date | null;
}

export interface StampProgram {
  stampsRequired: number;
}

export type ApplyStampOutcome =
  | { ok: true; card: StampCardState; rewardsEarned: number }
  | { ok: false; reason: "cooldown"; retryAfter: Date };

export type RedeemRewardOutcome =
  | { ok: true; card: StampCardState }
  | { ok: false; reason: "no_reward" };

export function isValidStampsRequired(value: number): boolean {
  return Number.isInteger(value) && value >= STAMPS_REQUIRED_MIN && value <= STAMPS_REQUIRED_MAX;
}

function assertProgram(program: StampProgram): void {
  if (!isValidStampsRequired(program.stampsRequired)) {
    throw new RangeError(
      `stampsRequired must be an integer ${STAMPS_REQUIRED_MIN}–${STAMPS_REQUIRED_MAX}`,
    );
  }
}

function cooldownMs(minutes: number): number {
  return Math.max(0, Number.isFinite(minutes) ? minutes : 0) * 60_000;
}

/** When the next stamp is allowed; null = right now. */
export function cooldownEndsAt(
  card: Pick<StampCardState, "lastVisitAt">,
  cooldownMinutes: number,
  now: Date,
): Date | null {
  const ms = cooldownMs(cooldownMinutes);
  if (!card.lastVisitAt || ms === 0) return null;
  const ends = card.lastVisitAt.getTime() + ms;
  return ends > now.getTime() ? new Date(ends) : null;
}

export function applyStamp(
  card: StampCardState,
  program: StampProgram,
  now: Date,
  cooldownMinutes: number = DEFAULT_STAMP_COOLDOWN_MINUTES,
): ApplyStampOutcome {
  assertProgram(program);
  const retryAfter = cooldownEndsAt(card, cooldownMinutes, now);
  if (retryAfter) return { ok: false, reason: "cooldown", retryAfter };

  const total = card.stampsCount + 1;
  const rewardsEarned = Math.floor(total / program.stampsRequired);
  return {
    ok: true,
    rewardsEarned,
    card: {
      stampsCount: total % program.stampsRequired,
      rewardsAvailable: card.rewardsAvailable + rewardsEarned,
      rewardsRedeemed: card.rewardsRedeemed,
      totalVisits: card.totalVisits + 1,
      firstVisitAt: card.firstVisitAt ?? now,
      lastVisitAt: now,
    },
  };
}

export function redeemReward(card: StampCardState): RedeemRewardOutcome {
  if (card.rewardsAvailable <= 0) return { ok: false, reason: "no_reward" };
  return {
    ok: true,
    card: {
      ...card,
      rewardsAvailable: card.rewardsAvailable - 1,
      rewardsRedeemed: card.rewardsRedeemed + 1,
    },
  };
}

/** Stamps still needed for the next reward (stamps_required when just rolled over). */
export function stampsUntilReward(card: Pick<StampCardState, "stampsCount">, program: StampProgram): number {
  assertProgram(program);
  return program.stampsRequired - (card.stampsCount % program.stampsRequired);
}

/** Maps a cards row (snake_case, ISO dates) to the domain state. */
export function cardStateFromRow(row: {
  stamps_count: number;
  rewards_available: number;
  rewards_redeemed: number;
  total_visits: number;
  first_visit_at: string | null;
  last_visit_at: string | null;
}): StampCardState {
  const date = (value: string | null) => (value ? new Date(value) : null);
  return {
    stampsCount: row.stamps_count,
    rewardsAvailable: row.rewards_available,
    rewardsRedeemed: row.rewards_redeemed,
    totalVisits: row.total_visits,
    firstVisitAt: date(row.first_visit_at),
    lastVisitAt: date(row.last_visit_at),
  };
}
