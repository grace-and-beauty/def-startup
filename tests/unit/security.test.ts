import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/lib/auth/redirect";
import { signStaffSession, verifyStaffSession } from "@/lib/auth/staff-session";
import { findStaffByPin, hashPin, isValidPin, verifyPin } from "@/lib/security/pin";
import { clientIpFromHeaders, hashIp, isStaffLoginLocked } from "@/lib/security/rate-limit";
import { encodeBase62, extractQrToken, generateQrToken, isValidQrToken } from "@/lib/security/tokens";

const SECRET = "test-secret-test-secret-test-secret-0123";

describe("qr tokens", () => {
  it("generates 22-char base62 tokens accepted by the DB pattern", () => {
    const tokens = new Set(Array.from({ length: 200 }, generateQrToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[0-9A-Za-z]{22}$/);
      expect(isValidQrToken(token)).toBe(true);
    }
  });

  it("encodes base62", () => {
    expect(encodeBase62(new Uint8Array([0]))).toBe("0");
    expect(encodeBase62(new Uint8Array([61]))).toBe("z");
    expect(encodeBase62(new Uint8Array([62]))).toBe("10");
  });

  it("extracts tokens from raw codes and card links", () => {
    expect(extractQrToken(" DemoCard00000001 ")).toBe("DemoCard00000001");
    expect(extractQrToken("https://x.test/card/DemoCard00000001")).toBe("DemoCard00000001");
    expect(extractQrToken("https://x.test/card/DemoCard00000001?x=1")).toBe("DemoCard00000001");
    expect(extractQrToken("short")).toBeNull();
    expect(extractQrToken("DemoCard0000000!")).toBeNull();
    expect(extractQrToken("https://x.test/c/avtomyika-demo")).toBeNull();
  });
});

describe("staff session", () => {
  const session = { businessId: "b-1", staffId: "s-1" };

  it("round-trips", async () => {
    const token = await signStaffSession(session, SECRET);
    await expect(verifyStaffSession(token, SECRET)).resolves.toEqual(session);
  });

  it("rejects a wrong secret, tampering and expiry", async () => {
    const now = new Date("2026-10-01T10:00:00Z");
    const token = await signStaffSession(session, SECRET, now);
    await expect(verifyStaffSession(token, `${SECRET}x`, now)).resolves.toBeNull();
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ bid: "other", sub: "s-1" })).toString("base64url");
    await expect(verifyStaffSession(`${h}.${forged}.${s}`, SECRET, now)).resolves.toBeNull();
    const later = new Date(now.getTime() + 12 * 3600_000 + 1000);
    await expect(verifyStaffSession(token, SECRET, later)).resolves.toBeNull();
    await expect(verifyStaffSession(undefined, SECRET)).resolves.toBeNull();
    await expect(verifyStaffSession("garbage", SECRET)).resolves.toBeNull();
  });
});

describe("pin", () => {
  it("validates format", () => {
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });

  it("hashes and finds the matching staff member", async () => {
    const a = { id: "a", pin_hash: await hashPin("1234") };
    const b = { id: "b", pin_hash: await hashPin("5678") };
    await expect(verifyPin("1234", a.pin_hash)).resolves.toBe(true);
    await expect(findStaffByPin("5678", [a, b])).resolves.toBe(b);
    await expect(findStaffByPin("0000", [a, b])).resolves.toBeNull();
  });
});

describe("rate limit helpers", () => {
  it("locks after 5 failures", () => {
    expect(isStaffLoginLocked(4)).toBe(false);
    expect(isStaffLoginLocked(5)).toBe(true);
  });

  it("hashes IPs and reads proxy headers", () => {
    expect(hashIp("1.2.3.4", "s")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("1.2.3.4", "s")).not.toBe(hashIp("1.2.3.4", "t"));
    expect(clientIpFromHeaders(new Headers({ "x-forwarded-for": "9.9.9.9, 10.0.0.1" }))).toBe("9.9.9.9");
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/dashboard/onboarding?niche=avtomyika", "/dashboard/onboarding?niche=avtomyika"],
    ["//evil.com", "/dashboard"],
    ["https://evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["", "/dashboard"],
    [null, "/dashboard"],
  ])("%s → %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});
