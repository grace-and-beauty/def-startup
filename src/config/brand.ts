/**
 * Service branding — the ONLY place where the product name / domain / contacts
 * live (docs/architecture.md §9). Chosen 2026-10-11: Tickity, tickity.app.
 */
export const brand = {
  name: "Tickity",
  domain: "tickity.app",
  supportEmail: "support@tickity.app",
  supportTelegram: "",
  /**
   * Who provides the service in the legal pages (src/config/legal). Paddle
   * requires the seller's real legal name. Replace with the ФОП / company
   * name once one is registered.
   */
  legalName: { uk: "Артем Маланчук", en: "Artem Malanchuk" },
  country: { uk: "Україна", en: "Ukraine" },
} as const;

export type Brand = typeof brand;
