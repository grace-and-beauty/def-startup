/** Shapes shared by the scanner Server Actions and the client UI. */

export interface ScanCard {
  id: string;
  customerName: string | null;
  stampsCount: number;
  stampsRequired: number;
  rewardsAvailable: number;
  totalVisits: number;
  /** ISO time when the next stamp is allowed (cooldown); null = now. */
  nextStampAt: string | null;
}

export type ScanFailure =
  | "invalid_code"
  | "not_found"
  | "staff_inactive"
  | "cooldown"
  | "no_reward"
  | "session_expired"
  | "inactive"
  | "error";

/** Card state after a stamp / redeem (the UI keeps the customer name from the lookup). */
export type ScanCardCounters = Omit<ScanCard, "customerName">;

export type LookupResult = { ok: true; card: ScanCard } | { ok: false; reason: ScanFailure };

export type ScanActionResult =
  | { ok: true; kind: "stamp" | "reward"; card: ScanCardCounters; rewardsEarned: number }
  | { ok: false; reason: ScanFailure; retryAfter?: string | null };

export type PinState =
  | { status: "idle" }
  | {
      status: "error";
      reason: "pinFormat" | "pinInvalid" | "locked" | "notConfigured" | "notFound" | "unknown";
    };
