/**
 * Service branding — the ONLY place where the product name / domain / contacts
 * live (docs/architecture.md §9). Chosen 2026-10-11: Tickity, tickity.app.
 */
export const brand = {
  name: "Tickity",
  domain: "tickity.app",
  supportEmail: "support@tickity.app",
  supportTelegram: "",
} as const;

export type Brand = typeof brand;
