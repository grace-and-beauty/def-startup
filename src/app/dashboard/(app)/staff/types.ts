export type StaffActionState =
  | { status: "idle" }
  | { status: "ok"; nonce: number }
  | {
      status: "error";
      reason:
        | "nameInvalid"
        | "pinInvalid"
        | "pinTaken"
        | "lastActive"
        | "limitReached"
        | "locked"
        | "notFound"
        | "sessionExpired"
        | "unknown";
      limit?: number;
    };

export const STAFF_ERROR_KEYS = {
  nameInvalid: "staff.nameInvalid",
  pinInvalid: "staff.pinInvalid",
  pinTaken: "staff.pinTaken",
  lastActive: "staff.lastActive",
  limitReached: "staff.limitReached",
  locked: "staff.lockedTitle",
  notFound: "staff.notFound",
  sessionExpired: "dashboard.sessionExpired",
  unknown: "common.error",
} as const;
