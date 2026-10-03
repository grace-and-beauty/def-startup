import Link from "next/link";

import { CardPreview } from "@/components/card-preview";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { listNiches } from "@/config/niches";
import { t } from "@/lib/i18n";

/** Pause before the first stamp lands, so the card is seen empty first. */
const STAMP_DELAY_MS = 450;

export default function HomePage() {
  const niches = listNiches();
  const sample = niches[0];

  return (
    <PublicShell>
      <section className="grid items-center gap-12 pt-2 md:grid-cols-[1fr_minmax(0,21rem)] md:gap-16">
        <div className="flex flex-col gap-6">
          <h1 className="font-display text-[clamp(2.1rem,5.2vw,3.5rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance">
            {t("home.title")}
          </h1>
          <p className="text-muted-foreground max-w-[34rem] text-lg leading-relaxed">{t("home.subtitle")}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">{t("nav.start")}</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/pricing">{t("nav.pricing")}</Link>
            </Button>
          </div>
          <p className="text-muted-foreground text-sm">{t("home.trialCta")}</p>
        </div>

        {sample ? (
          <div className="relative mx-auto w-full max-w-[21rem]">
            {/* A second card peeking from behind: the card lives in a wallet among others. */}
            <div
              aria-hidden
              className="bg-secondary absolute inset-0 translate-x-3 translate-y-3 rotate-[4deg] rounded-[1.375rem]"
            />
            <CardPreview
              className="relative md:-rotate-[2.5deg]"
              businessName={sample.sampleBusinessName}
              bgColor={sample.colors.bg}
              fgColor={sample.colors.fg}
              labelColor={sample.colors.label}
              rewardText={sample.rewardText}
              stampsRequired={sample.stampsRequired}
              stampsCount={sample.stampsRequired - 1}
              customerName={sample.landing.sampleCustomerName}
              animateStampsFrom={0}
              animationDelay={STAMP_DELAY_MS}
            />
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="font-display text-xl font-bold tracking-tight">{t("home.howTitle")}</h2>
        <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {([t("home.how1"), t("home.how2"), t("home.how3")] as const).map((text, i) => (
            <li key={i} className="border-primary/25 flex flex-col gap-3 border-t-2 pt-4">
              <span className="font-display text-primary text-3xl leading-none font-bold">{i + 1}</span>
              <span className="leading-relaxed">{text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold tracking-tight">{t("home.chooseNiche")}</h2>
        <ul className="grid sm:grid-cols-2 sm:gap-x-10">
          {niches.map((niche) => (
            <li key={niche.slug} className="border-b">
              <Link
                href={`/dlya/${niche.slug}`}
                className="group focus-visible:ring-ring/50 flex flex-col gap-1 rounded-md py-4 outline-none focus-visible:ring-[3px]"
              >
                <span className="group-hover:text-primary text-lg font-semibold underline-offset-4 transition-colors group-hover:underline">
                  {niche.name}
                </span>
                <span className="text-muted-foreground text-sm">
                  {t("home.nicheReward", { reward: niche.rewardText })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}
