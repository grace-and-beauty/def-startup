import bcrypt from "bcryptjs";

/** Staff PIN: 4–6 digits (docs/architecture.md §8). */
export const PIN_PATTERN = /^\d{4,6}$/;
const BCRYPT_ROUNDS = 10;

export function isValidPin(value: string): boolean {
  return PIN_PATTERN.test(value);
}

export function hashPin(pin: string): Promise<string> {
  if (!isValidPin(pin)) throw new Error("PIN must be 4–6 digits");
  return bcrypt.hash(pin, BCRYPT_ROUNDS);
}

export function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  if (!isValidPin(pin)) return Promise.resolve(false);
  return bcrypt.compare(pin, pinHash);
}

/**
 * Returns the first candidate whose hash matches the PIN, or null.
 * All candidates are checked so the response time does not reveal which
 * position matched.
 */
export async function findStaffByPin<T extends { pin_hash: string }>(
  pin: string,
  candidates: readonly T[],
): Promise<T | null> {
  const results = await Promise.all(candidates.map((c) => verifyPin(pin, c.pin_hash)));
  const index = results.indexOf(true);
  return index === -1 ? null : candidates[index];
}
