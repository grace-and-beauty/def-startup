export const LEGAL_DOCS = ["terms", "privacy", "refund"] as const;
export type LegalDocId = (typeof LEGAL_DOCS)[number];

export const LEGAL_LOCALES = ["uk", "en"] as const;
export type LegalLocale = (typeof LEGAL_LOCALES)[number];

/** A paragraph, or a bulleted list when it is an array. */
export type LegalBlock = string | readonly string[];

export interface LegalSection {
  heading: string;
  blocks: readonly LegalBlock[];
}

export interface LegalDocument {
  title: string;
  /** One-sentence summary — used as the page description. */
  summary: string;
  sections: readonly LegalSection[];
}
