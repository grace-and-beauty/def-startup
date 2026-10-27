/**
 * Legal pages required by Paddle (Merchant of Record): terms, privacy,
 * refunds — in Ukrainian (/legal/*) and English (/en/legal/*).
 *
 * DRAFT wording — must be reviewed by a lawyer before the public launch.
 * Bump LEGAL_UPDATED_AT whenever the meaning of any text changes.
 */
import { privacy } from "./privacy";
import { refund } from "./refund";
import { terms } from "./terms";
import { LEGAL_DOCS, type LegalDocId, type LegalDocument, type LegalLocale } from "./types";

export * from "./types";
export { REFUND_WINDOW_DAYS } from "./refund";

/** ISO date of the current version of all legal texts. */
export const LEGAL_UPDATED_AT = "2026-10-27";

/** Page chrome. Lives here, not in uk.json, because it is also shown in English. */
export const LEGAL_UI: Record<
  LegalLocale,
  { updated: string; dateLocale: string; switchLabel: string; otherDocs: string }
> = {
  uk: {
    updated: "Редакція від",
    dateLocale: "uk-UA",
    switchLabel: "English version",
    otherDocs: "Інші документи",
  },
  en: {
    updated: "Last updated",
    dateLocale: "en-GB",
    switchLabel: "Українська версія",
    otherDocs: "Other documents",
  },
};

const DOCS: Record<LegalDocId, Record<LegalLocale, LegalDocument>> = { terms, privacy, refund };

export function isLegalDocId(value: string): value is LegalDocId {
  return (LEGAL_DOCS as readonly string[]).includes(value);
}

export function getLegalDoc(id: string, locale: LegalLocale): LegalDocument | null {
  return isLegalDocId(id) ? DOCS[id][locale] : null;
}

/** Path of a legal page: /legal/terms, /en/legal/terms. */
export function legalPath(id: LegalDocId, locale: LegalLocale = "uk"): string {
  return locale === "uk" ? `/legal/${id}` : `/${locale}/legal/${id}`;
}
