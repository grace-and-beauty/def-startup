/**
 * Validation of owner input (onboarding, settings, staff, broadcasts).
 * Limits mirror the CHECK constraints in supabase/migrations. Pure (zod).
 */
import { z } from "zod";

import { NEW_PIN_PATTERN, PIN_PATTERN } from "@/lib/security/pin-format";

import { SLUG_PATTERN } from "./slug";

const trimmed = (max: number, min = 1) => z.string().trim().min(min).max(max);

/** Optional text: "" / whitespace → null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? null : value));

export const businessNameSchema = trimmed(80);
export const slugSchema = z.string().trim().regex(SLUG_PATTERN);
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const stampsRequiredSchema = z.coerce.number().int().min(2).max(20);
export const rewardTextSchema = trimmed(120);
export const termsTextSchema = optionalText(1000);
export const reminderDaysSchema = z.coerce.number().int().min(1).max(365);
export const reminderTextSchema = trimmed(120);
export const staffNameSchema = trimmed(60);
/** PIN typed at the scanner login. */
export const pinSchema = z.string().trim().regex(PIN_PATTERN);
/** PIN being set (wizard, new staff, PIN change). */
export const newPinSchema = z.string().trim().regex(NEW_PIN_PATTERN);
export const broadcastTextSchema = trimmed(120);
export const BROADCAST_MAX_LENGTH = 120;

/**
 * Owner's contact phone: a Ukrainian number typed any common way
 * ("+380 67 123 45 67", "067-123-45-67", "380671234567") → "+380671234567".
 * null when it is not a Ukrainian number. Mirrors the CHECK on
 * businesses.contact_phone.
 */
export function normalizeOwnerPhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  if (/^380\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+38${digits}`;
  return null;
}

export const ownerPhoneSchema = z.string().transform((raw, ctx) => {
  const phone = normalizeOwnerPhone(raw);
  if (!phone) {
    ctx.addIssue({ code: "custom", message: "invalid" });
    return z.NEVER;
  }
  return phone;
});

/** City of the business: spaces collapsed, 1–60 characters. */
export const citySchema = z
  .string()
  .transform((raw) => raw.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(1).max(60));

/** "" → null (not set); otherwise an integer 0…1 000 000 (UAH). */
export const avgCheckSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === "") return null;
    const n = Number(value.replace(/\s/g, ""));
    if (!Number.isInteger(n) || n < 0 || n > 1_000_000) {
      ctx.addIssue({ code: "custom", message: "invalid" });
      return z.NEVER;
    }
    return n;
  });

/** FormData value → string ("" for missing / File). */
export function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** FormData file → File or null when empty / missing. */
export function formFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
}
