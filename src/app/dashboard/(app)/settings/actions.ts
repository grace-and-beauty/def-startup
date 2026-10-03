"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ownerContextForAction, type OwnerContext } from "@/lib/auth/owner";
import { setBusinessLogo, updateBusiness, updateProgram } from "@/lib/data";
import {
  avgCheckSchema,
  businessNameSchema,
  formFile,
  formString,
  hexColorSchema,
  reminderDaysSchema,
  reminderTextSchema,
  rewardTextSchema,
  stampsRequiredSchema,
  termsTextSchema,
} from "@/lib/domain/business-input";
import { hasFeature } from "@/lib/domain/plans";
import { isAcceptableLogo } from "@/lib/security/upload";
import { removeBusinessLogo, uploadBusinessLogo } from "@/lib/storage/logos";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

import type { SettingsErrorReason, SettingsState } from "./types";

const fail = (reason: SettingsErrorReason): SettingsState => ({ status: "error", reason });

/** Runs `fn` for the signed-in owner; refreshes the dashboard on success. */
async function withOwner(
  name: string,
  fn: (ctx: OwnerContext) => Promise<SettingsState | void>,
): Promise<SettingsState> {
  const ctx = await ownerContextForAction();
  if (!ctx) return fail("sessionExpired");
  try {
    const result = await fn(ctx);
    if (result) return result;
  } catch (error) {
    console.error(`${name} failed`, error instanceof Error ? error.message : error);
    return fail("unknown");
  }
  // Business name / colors also appear in the layout and on the poster.
  revalidatePath("/dashboard", "layout");
  return { status: "ok", nonce: Date.now() };
}

export async function updateDesign(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const name = businessNameSchema.safeParse(formString(formData, "name"));
  if (!name.success) return fail("nameInvalid");
  const colors = {
    bg: hexColorSchema.safeParse(formString(formData, "bgColor")),
    fg: hexColorSchema.safeParse(formString(formData, "fgColor")),
    label: hexColorSchema.safeParse(formString(formData, "labelColor")),
  };
  if (!colors.bg.success || !colors.fg.success || !colors.label.success) return fail("colorInvalid");
  const patch = {
    name: name.data,
    bg_color: colors.bg.data,
    fg_color: colors.fg.data,
    label_color: colors.label.data,
  };
  return withOwner("updateDesign", async ({ supabase, business }) => {
    await updateBusiness(supabase, business.id, patch);
  });
}

export async function uploadLogo(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const file = formFile(formData, "logo");
  if (!file || !isAcceptableLogo(file)) return fail("logoInvalid");
  return withOwner("uploadLogo", async ({ business }) => {
    const admin = tryCreateSupabaseAdminClient();
    if (!admin) return fail("logoUnavailable");
    const upload = await uploadBusinessLogo(business.id, file);
    if (upload.status === "invalid") return fail("logoInvalid");
    if (upload.status === "unavailable") return fail("logoUnavailable");
    await setBusinessLogo(admin, business.id, upload.url);
    await removeBusinessLogo(business.id, business.logo_url);
  });
}

export async function removeLogo(_prev: SettingsState): Promise<SettingsState> {
  return withOwner("removeLogo", async ({ business }) => {
    const admin = tryCreateSupabaseAdminClient();
    if (!admin) return fail("logoUnavailable");
    await setBusinessLogo(admin, business.id, null);
    await removeBusinessLogo(business.id, business.logo_url);
  });
}

export async function updateRule(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const stamps = stampsRequiredSchema.safeParse(formString(formData, "stampsRequired"));
  if (!stamps.success) return fail("stampsInvalid");
  const reward = rewardTextSchema.safeParse(formString(formData, "rewardText"));
  if (!reward.success) return fail("rewardInvalid");
  const terms = termsTextSchema.safeParse(formString(formData, "termsText"));
  if (!terms.success) return fail("termsInvalid");
  return withOwner("updateRule", async ({ supabase, business, program }) => {
    await updateProgram(supabase, business.id, program.id, {
      stamps_required: stamps.data,
      reward_text: reward.data,
      terms_text: terms.data,
    });
  });
}

/** Checkbox: "on" when checked, absent otherwise. */
const checkboxSchema = z
  .union([z.literal("on"), z.null()])
  .transform((value) => value === "on");

export async function updateReminders(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const enabledParsed = checkboxSchema.safeParse(formData.get("enabled"));
  if (!enabledParsed.success) return fail("unknown");
  const enabled = enabledParsed.data;
  const rawDays = formString(formData, "reminderDays").trim();
  const rawText = formString(formData, "reminderText").trim();

  // Turned off: keep whatever valid values were typed, drop empty ones.
  const days = rawDays === "" && !enabled ? { success: true as const, data: null } : reminderDaysSchema.safeParse(rawDays);
  if (!days.success) return fail("reminderDaysInvalid");
  const text = rawText === "" && !enabled ? { success: true as const, data: null } : reminderTextSchema.safeParse(rawText);
  if (!text.success) return fail("reminderTextInvalid");

  return withOwner("updateReminders", async ({ supabase, business, program }) => {
    if (enabled && !hasFeature(business, "reminders", new Date())) return fail("remindersLocked");
    await updateProgram(supabase, business.id, program.id, {
      reminders_enabled: enabled,
      reminder_days: days.data,
      reminder_text: text.data,
    });
  });
}

export async function updateBusinessInfo(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const avgCheck = avgCheckSchema.safeParse(formString(formData, "avgCheck"));
  if (!avgCheck.success) return fail("avgCheckInvalid");
  return withOwner("updateBusinessInfo", async ({ supabase, business }) => {
    await updateBusiness(supabase, business.id, { avg_check: avgCheck.data });
  });
}
