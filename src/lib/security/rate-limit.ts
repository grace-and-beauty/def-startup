import { createHmac } from "node:crypto";

/** Staff PIN lockout (docs/architecture.md §5.2, §8). */
export const STAFF_LOGIN_MAX_FAILURES = 5;
export const STAFF_LOGIN_WINDOW_MINUTES = 15;

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
