import { createHmac } from "node:crypto";

/** Staff PIN lockout (docs/architecture.md §5.2, §8): 5 failures per IP + business / 15 min. */
export const STAFF_LOGIN_MAX_FAILURES = 5;
export const STAFF_LOGIN_WINDOW_MINUTES = 15;
/**
 * Failures for one business from ANY IP within the same window. A 4-digit PIN
 * has only 10 000 values; without this cap rotating IPs would make the
 * per-IP lockout useless. Staff already signed in (12 h session) are not
 * affected by a lock.
 */
export const STAFF_LOGIN_MAX_BUSINESS_FAILURES = 30;

/** New cards on /c/[slug]: ≤ 10 per minute per IP per business (architecture §5.1). */
export const JOIN_RATE_LIMIT = { scope: "join", max: 10, windowSeconds: 60 } as const;
/**
 * New cards per business per hour from ALL IPs. Without it a script with
 * rotating IPs fills the plan's customer limit (300 on Basic) in minutes and
 * real customers get "program unavailable". A queue at the till is far below this.
 */
export const JOIN_BUSINESS_RATE_LIMIT = { scope: "join_business", max: 120, windowSeconds: 3600 } as const;
/** Rate-limit key for limits counted per business, not per IP (key_hash needs ≥ 16 chars). */
export const BUSINESS_WIDE_KEY = "business-wide-limit";
/** "Save to Google Wallet" links per IP (hashed) per business: each one signs a JWT and calls Google. */
export const WALLET_SAVE_RATE_LIMIT = { scope: "wallet_save", max: 10, windowSeconds: 60 } as const;

export function staffLoginWindowStart(now: Date): Date {
  return new Date(now.getTime() - STAFF_LOGIN_WINDOW_MINUTES * 60_000);
}

export function isStaffLoginLocked(recentFailures: number): boolean {
  return recentFailures >= STAFF_LOGIN_MAX_FAILURES;
}

/** We never store raw IPs: HMAC-SHA256(ip, IP_HASH_SECRET). */
export function hashIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(ip).digest("hex");
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
