export type BroadcastTarget = "all" | "at_risk";

export type BroadcastState = {
  /** Successful sends during this visit (remounts the composer to clear it). */
  sent: number;
} & (
  | { status: "idle" }
  | { status: "ok"; recipients: number }
  | {
      status: "error";
      reason: "textInvalid" | "targetInvalid" | "quotaExhausted" | "noRecipients" | "sessionExpired" | "unknown";
    }
);
