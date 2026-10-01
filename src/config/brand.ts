/**
 * Service branding — the ONLY place where the product name / domain / contacts
 * live (docs/architecture.md §9). The name is a neutral placeholder until the
 * final brand is chosen.
 */
export const brand = {
  name: "Loyalty App",
  domain: "localhost:3000",
  supportEmail: "support@example.com",
  supportTelegram: "",
} as const;

export type Brand = typeof brand;
