import type { TranslationKey } from "@/lib/i18n";

export const ONBOARDING_FIELDS = [
  "niche",
  "nicheLabel",
  "name",
  "slug",
  "contactPhone",
  "city",
  "bgColor",
  "fgColor",
  "labelColor",
  "logo",
  "stampsRequired",
  "rewardText",
  "termsText",
  "pin",
  "pinConfirm",
] as const;

export type OnboardingField = (typeof ONBOARDING_FIELDS)[number];

export function isOnboardingField(value: unknown): value is OnboardingField {
  return typeof value === "string" && (ONBOARDING_FIELDS as readonly string[]).includes(value);
}

/** Wizard step (0-based) where a field lives — the wizard jumps there on an error. */
export const FIELD_STEP: Record<OnboardingField, number> = {
  niche: 0,
  nicheLabel: 0,
  name: 1,
  slug: 1,
  contactPhone: 1,
  city: 1,
  bgColor: 2,
  fgColor: 2,
  labelColor: 2,
  logo: 2,
  stampsRequired: 3,
  rewardText: 3,
  termsText: 3,
  pin: 4,
  pinConfirm: 4,
};

export const FIELD_ERROR_KEYS: Record<OnboardingField, TranslationKey> = {
  niche: "common.error",
  nicheLabel: "onboarding.nicheLabelInvalid",
  name: "onboarding.nameInvalid",
  slug: "onboarding.slugInvalid",
  contactPhone: "onboarding.contactPhoneInvalid",
  city: "onboarding.cityInvalid",
  bgColor: "onboarding.colorInvalid",
  fgColor: "onboarding.colorInvalid",
  labelColor: "onboarding.colorInvalid",
  logo: "onboarding.logoInvalid",
  stampsRequired: "onboarding.stampsInvalid",
  rewardText: "onboarding.rewardInvalid",
  termsText: "onboarding.termsInvalid",
  pin: "onboarding.pinInvalid",
  pinConfirm: "onboarding.pinMismatch",
};

export type OnboardingResult =
  | { status: "error"; reason: "sessionExpired" | "unknown" }
  | { status: "error"; field: OnboardingField; reason: "invalid" }
  | { status: "error"; field: "slug"; reason: "slugTaken"; suggestions: string[] };

export type SlugCheckResult =
  | { status: "ok" }
  | { status: "invalid" }
  | { status: "sessionExpired" }
  | { status: "taken"; suggestions: string[] };
