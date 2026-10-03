import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";

import { isValidPin } from "./pin-format";

export { isValidNewPin, isValidPin, NEW_PIN_PATTERN, PIN_PATTERN } from "./pin-format";

const BCRYPT_ROUNDS = 10;

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

/**
 * Short fingerprint of a staff member's current PIN hash, stored in the
 * scanner session. Changing the PIN changes the hash, so sessions signed in
 * with the old PIN stop working at once (a former employee keeps no access).
 */
export function pinVersion(pinHash: string): string {
  return createHash("sha256").update(pinHash).digest("base64url").slice(0, 16);
}
