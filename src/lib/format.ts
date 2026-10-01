/** Display formatting (uk-UA). Pure; safe in server and client components. */

const LOCALE = "uk-UA";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(LOCALE).format(value);
}

/** "1 жовт. 2026 р." in the business timezone. */
export function formatDate(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeZone }).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

/** "1 жовт. 2026 р., 14:05" in the business timezone. */
export function formatDateTime(value: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(typeof value === "string" ? new Date(value) : value);
}

/** "01.10" for chart axes, from a local "YYYY-MM-DD". */
export function formatShortDay(localDate: string): string {
  const [, month, day] = localDate.split("-");
  return `${day}.${month}`;
}
