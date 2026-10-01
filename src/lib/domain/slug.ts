/**
 * Business slug format — must match the DB CHECK constraint on
 * businesses.slug: 3–40 chars of [a-z0-9-], no leading/trailing hyphen.
 * (Generation from a Cyrillic name with transliteration: stage 3.)
 */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}
