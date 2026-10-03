import Link from "next/link";

import { PublicShell } from "@/components/public-shell";
import { StampIn } from "@/components/stamp-in";
import { StampMark } from "@/components/stamp-progress";
import { StampingCard } from "@/components/stamping-card";
import { Button } from "@/components/ui/button";
import { listNiches } from "@/config/niches";
import { t } from "@/lib/i18n";

export default function HomePage() {
  const niches = listNiches();
  const sample = niches[0];

  return (
    <PublicShell>
      <section className="grid items-center gap-12 pt-2 md:grid-cols-[1fr_minmax(0,21rem)] md:gap-16">
        <div className="flex flex-col gap-6">
          <h1 className="rise font-display text-[clamp(2.1rem,5.2vw,3.5rem)] leading-[1.05] font-bold tracking-[-0.03em] text-balance">
            {t("home.title")}
          </h1>
          <p
            className="rise text-muted-foreground max-w-[34rem] text-lg leading-relaxed"
            style={{ animationDelay: "140ms" }}
          >
            {t("home.subtitle")}
          </p>
          <div className="rise flex flex-wrap items-center gap-3" style={{ animationDelay: "260ms" }}>
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
            <StampingCard
              className="relative md:-rotate-[2.5deg]"
              businessName={sample.sampleBusinessName}
              bgColor={sample.colors.bg}
              fgColor={sample.colors.fg}
              labelColor={sample.colors.label}
              rewardText={sample.rewardText}
              stampsRequired={sample.stampsRequired}
              customerName={sample.landing.sampleCustomerName}
            />
          </div>
        ) : null}
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="font-display text-xl font-bold tracking-tight">{t("home.howTitle")}</h2>
        <ol className="grid gap-8 sm:grid-cols-3 sm:gap-6">
          {([t("home.how1"), t("home.how2"), t("home.how3")] as const).map((text, i) => (
            <li key={i} className="border-primary/25 flex flex-col gap-3 border-t-2 pt-4">
              <StampIn delay={i * 180} className="font-display text-primary w-fit text-3xl leading-none font-bold">
                {i + 1}
              </StampIn>
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
                <span className="group-hover:text-primary flex items-center gap-2 text-lg font-semibold transition-[color,transform] duration-300 group-hover:translate-x-1">
                  {niche.name}
                  <StampMark className="text-primary size-5 -rotate-12 scale-50 opacity-0 transition-[opacity,transform] duration-300 group-hover:scale-100 group-hover:opacity-100" />
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
