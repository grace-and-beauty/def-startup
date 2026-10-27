import { brand } from "@/config/brand";
import { getNiche, OTHER_NICHE } from "@/config/niches";
import { t } from "@/lib/i18n";

/**
 * «Картка — Tickity» under a customer's card and join page: every business
 * shows the service to its own customers (docs/marketing.md, channel 3). Links
 * to the landing of the business' niche, or to the card builder for «Інше».
 */
export function PoweredBy({ nicheSlug, source }: { nicheSlug: string; source: "card" | "join" }) {
  const niche = getNiche(nicheSlug);
  const href =
    niche && niche.slug !== OTHER_NICHE
      ? `/dlya/${niche.slug}?utm_source=${source}`
      : `/?utm_source=${source}#konstruktor`;
  return (
    <p className="text-muted-foreground text-center text-xs">
      {t("poweredBy.text", { brand: brand.name })}{" "}
      <a href={href} className="hover:text-foreground underline underline-offset-2">
        {t("poweredBy.cta")}
      </a>
    </p>
  );
}
