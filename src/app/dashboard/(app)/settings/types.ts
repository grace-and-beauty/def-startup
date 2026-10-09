export type SettingsErrorReason =
  | "nameInvalid"
  | "colorInvalid"
  | "logoInvalid"
  | "logoUnavailable"
  | "stampsInvalid"
  | "rewardInvalid"
  | "termsInvalid"
  | "reminderDaysInvalid"
  | "reminderTextInvalid"
  | "remindersLocked"
  | "avgCheckInvalid"
  | "phoneInvalid"
  | "cityInvalid"
  | "sessionExpired"
  | "unknown";

export type SettingsState =
  | { status: "idle" }
  | { status: "ok"; nonce: number }
  | { status: "error"; reason: SettingsErrorReason };

export const SETTINGS_ERROR_KEYS = {
  nameInvalid: "onboarding.nameInvalid",
  colorInvalid: "onboarding.colorInvalid",
  logoInvalid: "onboarding.logoInvalid",
  logoUnavailable: "settings.logoUnavailable",
  stampsInvalid: "onboarding.stampsInvalid",
  rewardInvalid: "onboarding.rewardInvalid",
  termsInvalid: "onboarding.termsInvalid",
  reminderDaysInvalid: "settings.reminderDaysInvalid",
  reminderTextInvalid: "settings.reminderTextInvalid",
  remindersLocked: "settings.remindersLocked",
  avgCheckInvalid: "settings.avgCheckInvalid",
  phoneInvalid: "onboarding.contactPhoneInvalid",
  cityInvalid: "onboarding.cityInvalid",
  sessionExpired: "dashboard.sessionExpired",
  unknown: "common.error",
} as const satisfies Record<SettingsErrorReason, string>;
