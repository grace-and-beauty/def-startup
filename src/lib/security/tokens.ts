import { randomBytes } from "node:crypto";

/**
 * Card QR tokens (docs/architecture.md §8): 16 random bytes (128 bit) encoded
 * as base62 — not sequential and not derived from any id. The database checks
 * the format with ^[0-9A-Za-z]{16,64}$.
 */

const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const TOKEN_BYTES = 16;

export const QR_TOKEN_PATTERN = /^[0-9A-Za-z]{16,64}$/;

const ZERO = BigInt(0);
const EIGHT = BigInt(8);
const SIXTY_TWO = BigInt(62);

export function encodeBase62(bytes: Uint8Array): string {
  let value = ZERO;
  for (const byte of bytes) value = (value << EIGHT) | BigInt(byte);
  if (value === ZERO) return "0";
  let out = "";
  while (value > ZERO) {
    out = BASE62[Number(value % SIXTY_TWO)] + out;
    value /= SIXTY_TWO;
  }
  return out;
}

/** New random card token, ~22 base62 characters. */
export function generateQrToken(): string {
  let token = encodeBase62(randomBytes(TOKEN_BYTES));
  // Leading zero bytes make the string shorter; pad to keep a stable length.
  while (token.length < 22) token = "0" + token;
  return token;
}

export function isValidQrToken(value: string): boolean {
  return QR_TOKEN_PATTERN.test(value);
}

/**
 * Accepts whatever the scanner or manual input produced: a bare token, or a
 * link that ends with /card/<token>. Returns null when nothing usable is found.
 */
export function extractQrToken(input: string): string | null {
  const text = input.trim();
  if (isValidQrToken(text)) return text;
  const match = /\/card\/([0-9A-Za-z]{16,64})(?:[/?#]|$)/.exec(text);
  return match ? match[1] : null;
}
