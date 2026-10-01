/**
 * Validation of owner input (onboarding, settings, staff, broadcasts).
 * Limits mirror the CHECK constraints in supabase/migrations. Pure (zod).
 */
import { z } from "zod";

import { PIN_PATTERN } from "@/lib/security/pin-format";

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
export const pinSchema = z.string().trim().regex(PIN_PATTERN);
export const broadcastTextSchema = trimmed(120);
export const BROADCAST_MAX_LENGTH = 120;

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
