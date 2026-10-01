import { describe, expect, it } from "vitest";

import { customerNameSchema, customerPhoneSchema } from "@/lib/domain/customer-input";
import { canAcceptCustomer } from "@/lib/domain/plans";
import type { BillingInfo } from "@/lib/domain/plans";
import { contentSecurityPolicy, securityHeaders } from "@/lib/security/headers";
import { JOIN_RATE_LIMIT, STAFF_LOGIN_MAX_BUSINESS_FAILURES, STAFF_LOGIN_MAX_FAILURES } from "@/lib/security/rate-limit";

const NOW = new Date("2026-10-01T12:00:00Z");
const ago = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const billing = (patch: Partial<BillingInfo>): BillingInfo => ({
  plan: "basic",
  trial_ends_at: ago(60),
  plan_renews_at: null,
  billing_status: "active",
  canceled_at: null,
  ...patch,
});

describe("security headers", () => {
  const header = (name: string, opts = { isDev: false }) =>
    securityHeaders(opts).find((h) => h.key === name)?.value;

  it("sets the headers from architecture §8", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Permissions-Policy")).toContain("camera=(self)");
    expect(header("Content-Security-Policy")).toBeDefined();
  });

  it("basic CSP: no framing, no plugins, forms only to self, no eval in production", () => {
    const csp = contentSecurityPolicy({ isDev: false });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy({ isDev: true })).toContain("'unsafe-eval'");
  });

  it("allows logos and API calls from the configured Supabase origin only", () => {
    const csp = contentSecurityPolicy({ isDev: false, supabaseUrl: "https://abc.supabase.co/" });
    expect(csp).toMatch(/img-src [^;]*https:\/\/abc\.supabase\.co/);
    expect(csp).toMatch(/connect-src [^;]*https:\/\/abc\.supabase\.co [^;]*wss:\/\/abc\.supabase\.co/);
    expect(contentSecurityPolicy({ isDev: false, supabaseUrl: "javascript:alert(1)" })).not.toContain("javascript");
  });

  it("upgrade-insecure-requests only for an https site", () => {
    expect(contentSecurityPolicy({ isDev: false, siteUrl: "https://x.test" })).toContain("upgrade-insecure-requests");
    expect(contentSecurityPolicy({ isDev: false, siteUrl: "http://localhost:3000" })).not.toContain(
      "upgrade-insecure-requests",
    );
  });
});

describe("rate limits", () => {
  it("match the documented values", () => {
    expect(STAFF_LOGIN_MAX_FAILURES).toBe(5);
    expect(STAFF_LOGIN_MAX_BUSINESS_FAILURES).toBeGreaterThan(STAFF_LOGIN_MAX_FAILURES);
    expect(JOIN_RATE_LIMIT).toEqual({ scope: "join", max: 10, windowSeconds: 60 });
  });
});

describe("canAcceptCustomer", () => {
  it("respects the plan's customer limit", () => {
    expect(canAcceptCustomer(billing({}), 299, NOW)).toBe(true);
    expect(canAcceptCustomer(billing({}), 300, NOW)).toBe(false);
    expect(canAcceptCustomer(billing({ plan: "pro" }), 1_000_000, NOW)).toBe(true);
  });

  it("refuses canceled and inactive businesses", () => {
    expect(canAcceptCustomer(billing({ billing_status: "canceled", canceled_at: ago(1) }), 0, NOW)).toBe(false);
    expect(canAcceptCustomer(billing({ billing_status: "canceled", canceled_at: ago(40) }), 0, NOW)).toBe(false);
  });
});

describe("customer input schemas", () => {
  it("normalizes optional name and phone", () => {
    expect(customerNameSchema.parse(null)).toBeNull();
    expect(customerNameSchema.parse("  Олена   К. ")).toBe("Олена К.");
    expect(customerPhoneSchema.parse("+38 (067) 123-45-67")).toBe("+380671234567");
    expect(customerPhoneSchema.parse("")).toBeNull();
  });

  it("rejects invalid values and non-strings", () => {
    expect(customerNameSchema.safeParse("x".repeat(81)).success).toBe(false);
    expect(customerPhoneSchema.safeParse("call me").success).toBe(false);
    expect(customerPhoneSchema.safeParse(new Blob(["1"])).success).toBe(false);
  });
});
