import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CardPreview } from "@/components/card-preview";
import { InkHero } from "@/components/ink-hero";
import { PhoneFrame, SampleBarcode } from "@/components/phone-frame";
import { PublicShell } from "@/components/public-shell";
import { StampMark } from "@/components/stamp-progress";
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
      <InkHero
        visual={
          <PhoneFrame cropped className="rise">
            <CardPreview
              businessName={niche.sampleBusinessName}
              bgColor={niche.colors.bg}
              fgColor={niche.colors.fg}
              labelColor={niche.colors.label}
              rewardText={niche.rewardText}
              stampsRequired={niche.stampsRequired}
              stampsCount={Math.max(1, niche.stampsRequired - 2)}
              customerName={niche.landing.sampleCustomerName}
            >
              <SampleBarcode />
            </CardPreview>
          </PhoneFrame>
        }
      >
        <h1 className="rise font-display text-[clamp(2rem,4.6vw,3.2rem)] leading-[1.08] font-semibold text-balance">
          {niche.landing.headline}
        </h1>
        <p className="rise text-ink-muted text-lg leading-relaxed" style={{ animationDelay: "120ms" }}>
          {niche.landing.subheadline}
        </p>
        <div className="rise flex flex-wrap gap-3" style={{ animationDelay: "220ms" }}>
          <Button asChild size="lg">
            <Link href={`/login?niche=${niche.slug}`}>{t("niche.cta")}</Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="text-ink-foreground hover:text-ink-foreground underline-offset-4 hover:bg-white/10 hover:underline"
          >
            <Link href="/pricing">{t("niche.pricingLink")}</Link>
          </Button>
        </div>
      </InkHero>

      <div className="grid gap-10 md:grid-cols-2">
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-semibold">{t("niche.painsTitle")}</h2>
          <ul className="flex flex-col gap-2">
            {niche.landing.pains.map((pain) => (
              <li key={pain} className="bg-card rounded-2xl border px-4 py-3">
                {pain}
              </li>
            ))}
          </ul>
        </section>
        <section className="flex flex-col gap-4">
          <h2 className="font-display text-3xl font-semibold">{t("niche.solutionTitle")}</h2>
          <ul className="flex flex-col gap-3">
            {solutions.map((item) => (
              <li key={item} className="flex gap-3">
                <StampMark className="text-primary mt-0.5 size-5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted-foreground text-sm">
            <span className="font-medium">{t("niche.exampleTitle")}:</span> {niche.termsText}
          </p>
        </section>
      </div>
    </PublicShell>
  );
}
