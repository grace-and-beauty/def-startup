/** Staff PIN format: 4–6 digits (docs/architecture.md §8). No deps — safe in the browser. */
export const PIN_PATTERN = /^\d{4,6}$/;

export function isValidPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}
