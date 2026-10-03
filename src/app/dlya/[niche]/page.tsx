import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CardPreview } from "@/components/card-preview";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { getNiche, NICHE_SLUGS } from "@/config/niches";
import { t } from "@/lib/i18n";

export const dynamicParams = false;

export function generateStaticParams() {
  return NICHE_SLUGS.map((niche) => ({ niche }));
}

export async function generateMetadata({
  params,
}: PageProps<"/dlya/[niche]">): Promise<Metadata> {
  const niche = getNiche((await params).niche);
  return niche ? { title: niche.landing.headline, description: niche.landing.subheadline } : {};
}

export default async function NicheLandingPage({ params }: PageProps<"/dlya/[niche]">) {
  const niche = getNiche((await params).niche);
  if (!niche) notFound();

  const solutions = [
    t("niche.solution1"),
    t("niche.solution2"),
    t("niche.solution3"),
    t("niche.solution4"),
  ];

  return (
    <PublicShell>
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          {niche.landing.headline}
        </h1>
        <p className="text-muted-foreground text-lg">{niche.landing.subheadline}</p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href={`/login?niche=${niche.slug}`}>{t("niche.cta")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">{t("niche.pricingLink")}</Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-10 md:grid-cols-2">
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">{t("niche.painsTitle")}</h2>
            <ul className="flex flex-col gap-2">
              {niche.landing.pains.map((pain) => (
                <li key={pain} className="bg-muted rounded-lg px-4 py-3">
                  {pain}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-xl font-bold tracking-tight">{t("niche.solutionTitle")}</h2>
            <ul className="flex flex-col gap-2">
              {solutions.map((item) => (
                <li key={item} className="flex gap-2">
                  <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">{t("niche.exampleTitle")}</h2>
          <CardPreview
            className="max-w-sm"
            businessName={niche.sampleBusinessName}
            bgColor={niche.colors.bg}
            fgColor={niche.colors.fg}
            labelColor={niche.colors.label}
            rewardText={niche.rewardText}
            stampsRequired={niche.stampsRequired}
            stampsCount={Math.max(1, niche.stampsRequired - 2)}
            customerName={niche.landing.sampleCustomerName}
          />
          <p className="text-muted-foreground max-w-sm text-sm">{niche.termsText}</p>
        </section>
      </div>
    </PublicShell>
  );
}
