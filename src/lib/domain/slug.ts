/**
 * Business slug format — must match the DB CHECK constraint on
 * businesses.slug: 3–40 chars of [a-z0-9-], no leading/trailing hyphen.
 * Pure (also imported by the onboarding wizard in the browser).
 */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

export function isValidSlug(value: string): boolean {
  return SLUG_PATTERN.test(value);
}

/**
 * Ukrainian national transliteration (Cabinet of Ministers resolution №55,
 * 2010), simplified to lower case: є/ї/й/ю/я at the start of a word become
 * "ye/yi/y/yu/ya", inside a word "ie/i/i/iu/ia"; "зг" → "zgh". Russian-only
 * letters get the usual Latin forms.
 */
const MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh", з: "z",
  и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ю: "iu", я: "ia", ь: "", "'": "", "’": "", "ʼ": "", "`": "",
  ё: "io", ы: "y", э: "e", ъ: "", "№": "",
};

/** Apostrophes are part of the word: «Знам'янка» → "znamianka". */
const APOSTROPHES = new Set(["'", "’", "ʼ", "`"]);

const WORD_START: Record<string, string> = { є: "ye", ї: "yi", й: "y", ю: "yu", я: "ya" };

const isWordChar = (ch: string | undefined) =>
  ch !== undefined && (APOSTROPHES.has(ch) || /\p{L}/u.test(ch));

export function transliterate(input: string): string {
  const text = input.toLowerCase();
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const prev = i > 0 ? text[i - 1] : undefined;
    if (ch === "г" && prev === "з") {
      out += "gh";
      continue;
    }
    if (!isWordChar(prev) && WORD_START[ch]) {
      out += WORD_START[ch];
      continue;
    }
    out += MAP[ch] ?? ch;
  }
  return out;
}

/**
 * "Автомийка «Блиск»" → "avtomyika-blysk". Returns "" when nothing usable is
 * left; the caller then asks the owner to type a slug.
 */
export function slugify(input: string): string {
  const base = transliterate(input)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base.slice(0, SLUG_MAX).replace(/-+$/g, "");
}

/** Normalizes manual input in the slug field (lower case, spaces → "-"). */
export function normalizeSlugInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SLUG_MAX);
}

/** Candidates for a taken slug: "blysk", "blysk-2", "blysk-3"… (each valid). */
export function slugCandidates(base: string, count = 5): string[] {
  const out: string[] = [];
  if (isValidSlug(base)) out.push(base);
  for (let n = 2; out.length < count && n < count + 10; n++) {
    const suffix = `-${n}`;
    const head = base.slice(0, SLUG_MAX - suffix.length).replace(/-+$/g, "");
    const candidate = `${head}${suffix}`;
    if (isValidSlug(candidate)) out.push(candidate);
  }
  return out;
}
