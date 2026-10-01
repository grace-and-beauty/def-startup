import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CardPreview } from "@/components/card-preview";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { brand } from "@/config/brand";
import { listNiches } from "@/config/niches";
import { t } from "@/lib/i18n";

export default function HomePage() {
  const niches = listNiches();
  const sample = niches[0];

  return (
    <PublicShell>
      <section className="grid items-center gap-8 md:grid-cols-[1fr_minmax(0,20rem)]">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("home.title", { brand: brand.name })}
          </h1>
          <p className="text-muted-foreground text-lg">{t("home.subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/login">{t("nav.start")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/pricing">{t("nav.pricing")}</Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{t("home.trialCta")}</p>
        </div>
        {sample ? (
          <CardPreview
            businessName={sample.sampleBusinessName}
            bgColor={sample.colors.bg}
            fgColor={sample.colors.fg}
            labelColor={sample.colors.label}
            rewardText={sample.rewardText}
            stampsRequired={sample.stampsRequired}
            stampsCount={Math.max(1, sample.stampsRequired - 2)}
            customerName={sample.landing.sampleCustomerName}
          />
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{t("home.howTitle")}</h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {([t("home.how1"), t("home.how2"), t("home.how3")] as const).map((text, i) => (
            <li key={i} className="bg-muted flex gap-3 rounded-lg p-4">
              <span className="text-muted-foreground font-mono text-sm">{i + 1}</span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold tracking-tight">{t("home.chooseNiche")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {niches.map((niche) => (
            <li key={niche.slug}>
              <Link
                href={`/dlya/${niche.slug}`}
                className="group focus-visible:ring-ring/50 block h-full rounded-xl outline-none focus-visible:ring-[3px]"
              >
                <Card className="group-hover:border-foreground/30 h-full transition-colors">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-2">
                      {niche.name}
                      <ArrowRight className="text-muted-foreground size-4" aria-hidden />
                    </CardTitle>
                    <CardDescription>
                      {t("home.nicheReward", { reward: niche.rewardText })}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}
