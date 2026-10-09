import { describe, expect, it } from "vitest";

import { citySchema, normalizeOwnerPhone } from "@/lib/domain/business-input";
import { normalizeCustomerName, normalizePhone } from "@/lib/domain/customer-input";
import { isValidSlug } from "@/lib/domain/slug";

describe("customer input", () => {
  it("normalizes names", () => {
    expect(normalizeCustomerName("  Олена   Петрівна ")).toBe("Олена Петрівна");
    expect(normalizeCustomerName("")).toBeNull();
    expect(normalizeCustomerName(null)).toBeNull();
    expect(normalizeCustomerName("x".repeat(81))).toBeUndefined();
  });

  it("normalizes phones", () => {
    expect(normalizePhone("+380 (67) 123-45-67")).toBe("+380671234567");
    expect(normalizePhone("067 123 45 67")).toBe("0671234567");
    expect(normalizePhone("  ")).toBeNull();
    expect(normalizePhone("abc")).toBeUndefined();
    expect(normalizePhone("12345")).toBeUndefined();
    expect(normalizePhone("1".repeat(16))).toBeUndefined();
  });
});

describe("slug", () => {
  it("matches the DB constraint", () => {
    expect(isValidSlug("avtomyika-demo")).toBe(true);
    expect(isValidSlug("abc")).toBe(true);
    expect(isValidSlug("ab")).toBe(false);
    expect(isValidSlug("-abc")).toBe(false);
    expect(isValidSlug("abc-")).toBe(false);
    expect(isValidSlug("Abc")).toBe(false);
    expect(isValidSlug("a".repeat(41))).toBe(false);
  });
});

describe("owner contacts", () => {
  it.each([
    ["+380 67 123 45 67", "+380671234567"],
    ["067-123-45-67", "+380671234567"],
    ["(067) 123 45 67", "+380671234567"],
    ["380671234567", "+380671234567"],
    [" +380671234567 ", "+380671234567"],
  ])("normalizes %s", (raw, phone) => {
    expect(normalizeOwnerPhone(raw)).toBe(phone);
  });

  it.each(["", "12345", "+48 601 234 567", "+380 67 123 45", "067 123 45 678", "phone", "+380-67-abc"])(
    "rejects %s",
    (raw) => {
      expect(normalizeOwnerPhone(raw)).toBeNull();
    },
  );

  it("collapses spaces in the city and caps its length", () => {
    expect(citySchema.parse("  Біла   Церква ")).toBe("Біла Церква");
    expect(citySchema.safeParse("   ").success).toBe(false);
    expect(citySchema.safeParse("x".repeat(61)).success).toBe(false);
  });
});
