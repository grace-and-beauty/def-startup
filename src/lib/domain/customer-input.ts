/**
 * Normalization of the optional customer fields on /c/[slug] (pure).
 * Empty input → null. Invalid input → undefined (caller reports an error).
 */

export const CUSTOMER_NAME_MAX = 80;

export function normalizeCustomerName(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return undefined;
  const name = raw.replace(/\s+/g, " ").trim();
  if (name === "") return null;
  if (name.length > CUSTOMER_NAME_MAX) return undefined;
  return name;
}

/** Keeps a leading "+" and digits; 7–15 digits (E.164 max). */
export function normalizePhone(raw: unknown): string | null | undefined {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return undefined;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return undefined;
  return (trimmed.startsWith("+") ? "+" : "") + digits;
}
