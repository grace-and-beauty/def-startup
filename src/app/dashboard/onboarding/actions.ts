"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { getNiche, isNicheSlug, OTHER_NICHE } from "@/config/niches";
import { getOwnerBusiness, getOwnerSession } from "@/lib/auth/owner";
import { DataError, isSlugTaken, onboardBusiness, setBusinessLogo, setBusinessNicheLabel } from "@/lib/data";
import {
  businessNameSchema,
  citySchema,
  formFile,
  formString,
  hexColorSchema,
  newPinSchema,
  nicheLabelSchema,
  ownerPhoneSchema,
  rewardTextSchema,
  slugSchema,
  stampsRequiredSchema,
  termsTextSchema,
} from "@/lib/domain/business-input";
import { slugCandidates } from "@/lib/domain/slug";
import { t } from "@/lib/i18n";
import { hashPin } from "@/lib/security/pin";
import { isAcceptableLogo } from "@/lib/security/upload";
import { uploadBusinessLogo } from "@/lib/storage/logos";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

import { isOnboardingField, type OnboardingField, type OnboardingResult, type SlugCheckResult } from "./types";
import { logEvent } from "@/lib/log";

/**
 * Free slug candidates (service role: other owners' slugs are invisible to
 * RLS). Only the boolean "taken" leaks, and only to signed-in owners.
 */
async function freeSlugs(base: string, ownSlug: string | null): Promise<string[] | null> {
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return null;
  const free: string[] = [];
  for (const candidate of slugCandidates(base, 6)) {
    if (candidate === ownSlug || !(await isSlugTaken(admin, candidate))) free.push(candidate);
    if (free.length >= 3) break;
  }
  return free;
}

/** Step 2 of the wizard: is the slug free? Suggests alternatives when not. */
export async function checkSlug(rawSlug: string): Promise<SlugCheckResult> {
  const parsed = slugSchema.safeParse(rawSlug);
  if (!parsed.success) return { status: "invalid" };
  const slug = parsed.data;
  const session = await getOwnerSession();
  if (!session) return { status: "sessionExpired" };

  const own = await getOwnerBusiness();
  const ownSlug = own?.business.slug ?? null;
  const admin = tryCreateSupabaseAdminClient();
  // Without the service role we can't check; the final submit still catches duplicates.
  if (!admin) return { status: "ok" };
  try {
    if (slug === ownSlug || !(await isSlugTaken(admin, slug))) return { status: "ok" };
    const suggestions = (await freeSlugs(slug, ownSlug)) ?? [];
    return { status: "taken", suggestions: suggestions.filter((s) => s !== slug) };
  } catch (error) {
    logEvent("error", "action_failed", { action: "checkSlug", error });
    return { status: "ok" };
  }
}

const schema = z.object({
  niche: z.string().refine(isNicheSlug),
  nicheLabel: z.string(),
  name: businessNameSchema,
  slug: slugSchema,
  contactPhone: ownerPhoneSchema,
  city: citySchema,
  bgColor: hexColorSchema,
  fgColor: hexColorSchema,
  labelColor: hexColorSchema,
  stampsRequired: stampsRequiredSchema,
  rewardText: rewardTextSchema,
  termsText: termsTextSchema,
  pin: newPinSchema,
  pinConfirm: z.string().trim(),
});

function fieldError(field: OnboardingField): OnboardingResult {
  return { status: "error", field, reason: "invalid" };
}

/**
 * Final step: business + program + staff «Загальний» in one transaction
 * (RPC onboard_business), then the optional logo. Redirects to the final
 * screen on success.
 */
export async function completeOnboarding(formData: FormData): Promise<OnboardingResult> {
  const session = await getOwnerSession();
  if (!session) return { status: "error", reason: "sessionExpired" };

  const parsed = schema.safeParse({
    niche: formString(formData, "niche"),
    nicheLabel: formString(formData, "nicheLabel"),
    name: formString(formData, "name"),
    slug: formString(formData, "slug"),
    contactPhone: formString(formData, "contactPhone"),
    city: formString(formData, "city"),
    bgColor: formString(formData, "bgColor"),
    fgColor: formString(formData, "fgColor"),
    labelColor: formString(formData, "labelColor"),
    stampsRequired: formString(formData, "stampsRequired"),
    rewardText: formString(formData, "rewardText"),
    termsText: formString(formData, "termsText"),
    pin: formString(formData, "pin"),
    pinConfirm: formString(formData, "pinConfirm"),
  });
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0];
    return fieldError(isOnboardingField(field) ? field : "niche");
  }
  const input = parsed.data;
  if (input.pin !== input.pinConfirm) return fieldError("pinConfirm");

  const logo = formFile(formData, "logo");
  if (logo && !isAcceptableLogo(logo)) return fieldError("logo");

  const niche = getNiche(input.niche);
  if (!niche) return fieldError("niche");
  // «Інше» needs the owner's own category; other niches ignore the field.
  let nicheLabel: string | null = null;
  if (niche.slug === OTHER_NICHE) {
    const label = nicheLabelSchema.safeParse(input.nicheLabel);
    if (!label.success) return fieldError("nicheLabel");
    nicheLabel = label.data;
  }

  let businessId: string;
  let alreadyDone = false;
  try {
    const result = await onboardBusiness(session.supabase, {
      name: input.name,
      slug: input.slug,
      nicheSlug: niche.slug,
      bgColor: input.bgColor,
      fgColor: input.fgColor,
      labelColor: input.labelColor,
      stampsRequired: input.stampsRequired,
      rewardText: input.rewardText,
      termsText: input.termsText,
      reminderDays: niche.reminderDays,
      reminderText: niche.reminderText,
      staffName: t("onboarding.defaultStaffName"),
      staffPinHash: await hashPin(input.pin),
      contactPhone: input.contactPhone,
      city: input.city,
    });
    alreadyDone = result.status === "already_done";
    businessId = result.business_id;
    if (!alreadyDone) logEvent("info", "business_onboarded", { businessId, niche: niche.slug, nicheLabel });
  } catch (error) {
    if (error instanceof DataError && error.isUniqueViolation) {
      const suggestions = (await freeSlugs(input.slug, null).catch(() => null)) ?? [];
      return { status: "error", field: "slug", reason: "slugTaken", suggestions };
    }
    logEvent("error", "action_failed", { action: "completeOnboarding", error });
    return { status: "error", reason: "unknown" };
  }
  if (alreadyDone) redirect("/dashboard");

  if (nicheLabel) {
    // Nice to have (only /admin shows it): a failure never fails onboarding.
    try {
      const admin = tryCreateSupabaseAdminClient();
      if (admin) await setBusinessNicheLabel(admin, businessId, nicheLabel);
    } catch (error) {
      logEvent("warn", "action_failed", { action: "onboarding niche label", error });
    }
  }

  let logoFailed = false;
  if (logo) {
    try {
      const upload = await uploadBusinessLogo(businessId, logo);
      const admin = tryCreateSupabaseAdminClient();
      if (upload.status === "ok" && admin) {
        // businessId comes from onboard_business, which ran as this owner.
        await setBusinessLogo(admin, businessId, upload.url);
      } else {
        logoFailed = true;
      }
    } catch (error) {
      logEvent("error", "action_failed", { action: "onboarding logo", error });
      logoFailed = true;
    }
  }

  redirect(logoFailed ? "/dashboard/onboarding/done?logo=failed" : "/dashboard/onboarding/done");
}
