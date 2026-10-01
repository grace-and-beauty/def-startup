/**
 * Automatic reminders (docs/architecture.md §5.4) — pure functions.
 *
 * A card is reminded when
 *  - the program has reminders enabled with a day count and a text,
 *  - the customer has visited at least once,
 *  - ≥ reminder_days have passed since the last visit, and
 *  - it was not reminded since that visit (last_reminder_at null or earlier
 *    than last_visit_at) — one reminder per "absence", never a series.
 * The plan check (feature "reminders") is done by the caller via hasFeature().
 */

const DAY_MS = 86_400_000;

export const REMINDER_DAYS_MIN = 1;
export const REMINDER_DAYS_MAX = 365;

export interface ReminderProgram {
  reminders_enabled: boolean;
  reminder_days: number | null;
  reminder_text: string | null;
}

export interface ReminderCard {
  last_visit_at: string | null;
  last_reminder_at: string | null;
}

export interface ReminderSettings {
  days: number;
  text: string;
}

/** Usable settings, or null when reminders are off / incomplete. */
export function reminderSettings(program: ReminderProgram): ReminderSettings | null {
  if (!program.reminders_enabled) return null;
  const days = program.reminder_days;
  const text = program.reminder_text?.trim() ?? "";
  if (days === null || !Number.isInteger(days) || days < REMINDER_DAYS_MIN || days > REMINDER_DAYS_MAX) return null;
  if (text === "") return null;
  return { days, text };
}

function time(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

export function isDueForReminder(card: ReminderCard, days: number, now: Date): boolean {
  const lastVisit = time(card.last_visit_at);
  if (lastVisit === null) return false;
  if (now.getTime() - lastVisit < days * DAY_MS) return false;
  const lastReminder = time(card.last_reminder_at);
  return lastReminder === null || lastReminder < lastVisit;
}

/** Cards to remind now (empty when the program has no usable settings). */
export function selectCardsToRemind<T extends ReminderCard>(
  cards: readonly T[],
  program: ReminderProgram,
  now: Date,
): T[] {
  const settings = reminderSettings(program);
  if (!settings) return [];
  return cards.filter((card) => isDueForReminder(card, settings.days, now));
}

/** Last visit must be at or before this moment for a card to be a candidate (query pre-filter). */
export function reminderCutoff(days: number, now: Date): Date {
  return new Date(now.getTime() - days * DAY_MS);
}
