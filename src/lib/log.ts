/**
 * Structured server logs (docs/pilot-readiness.md, docs/support.md): one JSON
 * line per event, so Vercel logs / a log drain can be searched by `event`,
 * `businessId` and `level`.
 *
 * Never log personal data or secrets: no names, phones, emails, PINs, card
 * tokens, session cookies. Pass ids (business, card, staff) and counts.
 * As a safety net every string is scrubbed of email-, phone- and
 * token-shaped values, and errors are reduced to name + message + code.
 */

export type LogLevel = "info" | "warn" | "error";

export type LogEvent =
  | "business_onboarded"
  | "card_issued"
  | "card_issue_failed"
  | "card_join_rejected"
  | "consent_changed"
  | "consent_change_failed"
  | "staff_login_failed"
  | "staff_login_locked"
  | "staff_login_succeeded"
  | "staff_action_failed"
  | "stamp_added"
  | "stamp_rejected"
  | "reward_redeemed"
  | "reward_rejected"
  | "broadcast_sent"
  | "broadcast_failed"
  | "wallet_task_failed"
  | "wallet_save_failed"
  | "reminders_run"
  | "reminders_failed"
  | "customer_anonymized"
  | "data_exported"
  | "request_error"
  | "action_failed";

type Field = string | number | boolean | null | undefined | unknown;

const EMAIL = /[^\s@"']+@[^\s@"']+\.[^\s@"']+/g;
const PHONE = /\+?\d[\d\s()-]{7,}\d/g;
/** Card QR tokens / hex secrets: long runs of letters and digits without separators. */
const TOKEN = /\b[0-9A-Za-z]{16,64}\b/g;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function scrub(value: string): string {
  return value.replace(EMAIL, "[email]").replace(TOKEN, "[token]").replace(PHONE, "[phone]");
}

function describeError(error: unknown): Record<string, string> {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      name: error.name,
      message: scrub(error.message).slice(0, 300),
      ...(typeof code === "string" ? { code } : {}),
    };
  }
  return { message: scrub(String(error)).slice(0, 300) };
}

function clean(value: Field): unknown {
  // Record ids (business, card, staff) are what support searches by; keep them.
  if (typeof value === "string") return UUID.test(value) ? value : scrub(value).slice(0, 300);
  if (value instanceof Error) return describeError(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return value;
  return scrub(JSON.stringify(value) ?? "").slice(0, 300);
}

export function logEvent(level: LogLevel, event: LogEvent, fields: Record<string, Field> = {}): void {
  const entry: Record<string, unknown> = { level, event, at: new Date().toISOString() };
  for (const [key, value] of Object.entries(fields)) {
    entry[key] = key === "error" ? describeError(value) : clean(value);
  }
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
