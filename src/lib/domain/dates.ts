/**
 * Calendar helpers in a business' IANA timezone (pure, no I/O).
 *
 * Analytics RPCs take local calendar dates ("YYYY-MM-DD"); quotas such as
 * "2 broadcasts per calendar month" need the UTC instant of a local midnight.
 */

export type LocalDate = string;

const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function parts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of formatter.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export function parseLocalDate(value: LocalDate): { year: number; month: number; day: number } {
  const match = LOCAL_DATE_PATTERN.exec(value);
  if (!match) throw new Error(`Invalid local date: ${value}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** Local calendar date of an instant in `timeZone`. */
export function toLocalDate(date: Date, timeZone: string): LocalDate {
  const p = parts(date, timeZone);
  return formatLocalDate(p.year, p.month, p.day);
}

/** Calendar arithmetic on local dates (timezone-independent). */
export function addDays(value: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(value);
  const d = new Date(Date.UTC(year, month - 1, day + days));
  return formatLocalDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Whole days from `from` to `to` (to − from). */
export function diffDays(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000,
  );
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function startOfMonth(value: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(value);
  return formatLocalDate(year, month, 1);
}

/** Offset of `timeZone` from UTC at `date`, in milliseconds (Kyiv summer: +3h). */
export function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const p = parts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** UTC instant of 00:00 local time on `value` in `timeZone` (DST-safe). */
export function zonedMidnight(value: LocalDate, timeZone: string): Date {
  const { year, month, day } = parseLocalDate(value);
  const guess = Date.UTC(year, month - 1, day);
  let instant = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  // Second pass: the offset at the real instant may differ around DST changes.
  instant = guess - timeZoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

export interface DateRange {
  from: LocalDate;
  to: LocalDate;
}

/**
 * Month-to-date vs the same days of the previous month:
 * today = 2026-10-15 → current 10-01…10-15, previous 09-01…09-15
 * (clamped to the previous month's length: 03-31 → 02-01…02-28).
 */
export function monthToDateComparison(today: LocalDate): { current: DateRange; previous: DateRange } {
  const { year, month, day } = parseLocalDate(today);
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevDay = Math.min(day, daysInMonth(prevYear, prevMonth));
  return {
    current: { from: formatLocalDate(year, month, 1), to: today },
    previous: {
      from: formatLocalDate(prevYear, prevMonth, 1),
      to: formatLocalDate(prevYear, prevMonth, prevDay),
    },
  };
}

/** Whole days left until `until` (rounded up, never negative). */
export function daysLeft(until: Date, now: Date): number {
  return Math.max(0, Math.ceil((until.getTime() - now.getTime()) / 86_400_000));
}
