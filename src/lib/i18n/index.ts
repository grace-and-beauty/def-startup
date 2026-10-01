/**
 * Tiny i18n helper. All UI texts go through t("dot.path") — no hardcoded
 * strings in components. Only Ukrainian in the MVP; the dictionary shape is
 * typed, so a missing / misspelled key is a compile error.
 *
 *   t("home.title", { brand: brand.name })
 */
import uk from "./locales/uk.json";

export type Locale = "uk";
export const DEFAULT_LOCALE: Locale = "uk";

type Dictionary = typeof uk;

const DICTIONARIES: Record<Locale, Dictionary> = { uk };

/** "a.b.c" for every string leaf of the dictionary. */
type LeafKeys<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends Record<string, unknown>
      ? LeafKeys<T[K], `${Prefix}${K}.`>
      : never;
}[keyof T & string];

export type TranslationKey = LeafKeys<Dictionary>;

export type TranslationParams = Record<string, string | number>;

function lookup(dict: unknown, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Replaces {name} placeholders; unknown placeholders are left as is. */
export function interpolate(template: string, params?: TranslationParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function translate(locale: Locale, key: TranslationKey, params?: TranslationParams): string {
  const value = lookup(DICTIONARIES[locale], key) ?? lookup(DICTIONARIES[DEFAULT_LOCALE], key);
  // Falling back to the key keeps the UI usable and makes gaps visible.
  return interpolate(value ?? key, params);
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  return translate(DEFAULT_LOCALE, key, params);
}
