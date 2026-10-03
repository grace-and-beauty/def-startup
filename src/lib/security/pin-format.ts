/** Staff PIN format (docs/architecture.md §8). No deps — safe in the browser. */

/** Any PIN that can sign in: 4–6 digits (PINs set before 4 Oct 2026 may be 4 digits). */
export const PIN_PATTERN = /^\d{4,6}$/;

/**
 * New or changed PINs: exactly 6 digits. The login lockout allows ~30 guesses
 * per business per 15 min; 10 000 four-digit PINs fall in about two days,
 * 1 000 000 six-digit ones take years.
 */
export const NEW_PIN_PATTERN = /^\d{6}$/;
export const NEW_PIN_LENGTH = 6;

export function isValidPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

export function isValidNewPin(value: string): boolean {
  return NEW_PIN_PATTERN.test(value);
}
