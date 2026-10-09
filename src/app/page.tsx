import { ArrowRight, ImageIcon } from "lucide-react";
import Link from "next/link";

import { InkHero } from "@/components/ink-hero";
import { PhoneFrame, SampleBarcode, WalletPeek } from "@/components/phone-frame";
import { PublicShell } from "@/components/public-shell";
import { CardPreview } from "@/components/card-preview";
import { StampingCard } from "@/components/stamping-card";
import { Button } from "@/components/ui/button";
import { listNiches } from "@/config/niches";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default function HomePage() {
  const niches = listNiches();
  const barbershop = niches.find((niche) => niche.slug === "barbershop") ?? niches[0];
  const others = niches.filter((niche) => niche !== barbershop);
  const peek = others.slice(0, 2).map((niche) => ({
    name: niche.sampleBusinessName,
    bg: niche.colors.bg,
    fg: niche.colors.fg,
  }));
  const how = [
    { title: t("home.how1Title"), text: t("home.how1") },
    { title: t("home.how2Title"), text: t("home.how2") },
    { title: t("home.how3Title"), text: t("home.how3") },
  ];

  return (
    <PublicShell>
      <div className="flex flex-col gap-6">
        <InkHero
          visual={
            barbershop ? (
              <PhoneFrame cropped className="rise grayscale">
                <WalletPeek cards={peek} />
                <StampingCard
                  className="relative"
                  businessName={barbershop.sampleBusinessName}
                  bgColor={barbershop.colors.bg}
                  fgColor={barbershop.colors.fg}
                  labelColor={barbershop.colors.label}
                  rewardText={barbershop.rewardText}
                  stampsRequired={barbershop.stampsRequired}
                >
                  <SampleBarcode />
                </StampingCard>
              </PhoneFrame>
            ) : null
          }
        >
          <h1 className="rise font-display text-[clamp(2.2rem,5.4vw,3.6rem)] leading-[1.05] font-semibold text-balance">
            {t("home.titleLead")}{" "}
            <em className="text-accent-on-ink">{t("home.titleAccent")}</em>
          </h1>
          <p
            className="rise text-ink-muted max-w-[32rem] text-lg leading-relaxed"
            style={{ animationDelay: "120ms" }}
          >
            {t("home.subtitle")}
          </p>
          <div className="rise flex flex-wrap items-center gap-3" style={{ animationDelay: "220ms" }}>
            <Button asChild size="lg" className="bg-ink-foreground text-ink hover:bg-ink-foreground/90">
              <Link href="/login">
                {t("nav.start")}
                <ArrowRight aria-hidden />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-ink-foreground hover:text-ink-foreground underline-offset-4 hover:bg-white/10 hover:underline"
            >
              <Link href="/pricing">{t("nav.pricing")}</Link>
            </Button>
          </div>
          <p className="text-ink-muted text-sm">{t("home.trialCta")}</p>
        </InkHero>

        <p className="text-muted-foreground flex flex-wrap items-baseline justify-center gap-x-6 gap-y-1 px-2 text-center">
          <span className="sr-only">{t("home.nichesStripLabel")}: </span>
          {niches.map((niche) => (
            <span key={niche.slug} className="font-display text-lg italic">
              {niche.name}
            </span>
          ))}
        </p>
      </div>

      <section className="flex flex-col gap-10">
        <h2 className="font-display text-center text-3xl font-semibold">{t("home.howTitle")}</h2>
        <div className="grid items-center gap-10 md:grid-cols-[1fr_minmax(0,17rem)_1fr] md:gap-8">
          <ol className="order-2 flex flex-col gap-8 md:order-1">
            {how.slice(0, 2).map((step, i) => (
              <HowStep key={step.title} index={i} title={step.title} text={step.text} side="left" />
            ))}
          </ol>
          {barbershop ? (
            <PhoneFrame className="order-1 mx-auto grayscale md:order-2">
              <CardPreview
                businessName={barbershop.sampleBusinessName}
                bgColor={barbershop.colors.bg}
                fgColor={barbershop.colors.fg}
                labelColor={barbershop.colors.label}
                rewardText={barbershop.rewardText}
                stampsRequired={barbershop.stampsRequired}
                stampsCount={barbershop.stampsRequired - 2}
                customerName={barbershop.landing.sampleCustomerName}
              >
                <SampleBarcode />
              </CardPreview>
            </PhoneFrame>
          ) : null}
          <ol start={3} className="order-3 flex flex-col gap-8">
            <HowStep index={2} title={how[2]?.title ?? ""} text={how[2]?.text ?? ""} side="right" />
          </ol>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="font-display text-3xl font-semibold">{t("home.chooseNiche")}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {niches.map((niche) => (
            <li key={niche.slug}>
              <Link
                href={`/dlya/${niche.slug}`}
                className="group bg-card focus-visible:ring-ring/50 flex h-full flex-col overflow-hidden rounded-2xl border outline-none transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-24px_rgb(20_20_20/0.5)] focus-visible:ring-[3px]"
              >
                {/* Placeholder until real photos of the pilot businesses. */}
                <span className="bg-muted text-muted-foreground flex aspect-[4/3] flex-col items-center justify-center gap-2 px-2 text-center text-xs">
                  <ImageIcon className="size-6 opacity-60" aria-hidden />
                  {t("home.photoPlaceholder", { niche: niche.name })}
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3 sm:p-4">
                  <span className="flex items-center justify-between gap-2 font-semibold sm:text-lg">
                    {niche.name}
                    <ArrowRight
                      className="text-primary size-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </span>
                  <span className="text-muted-foreground text-xs sm:text-sm">
                    {t("home.nicheReward", { reward: niche.rewardText })}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PublicShell>
  );
}

/** One "how it works" callout; on desktop a line with an arrow points at the phone. */
function HowStep({
  index,
  title,
  text,
  side,
}: {
  index: number;
  title: string;
  text: string;
  side: "left" | "right";
}) {
  return (
    <li className={cn("flex flex-col gap-2", side === "left" && "md:items-end md:text-right")}>
      <span className="font-display text-primary text-3xl leading-none italic">{index + 1}</span>
      <span className="text-lg font-semibold">{title}</span>
      <span className="text-muted-foreground max-w-[18rem] leading-relaxed">{text}</span>
      <span
        aria-hidden
        className={cn(
          "bg-foreground/30 relative mt-1 hidden h-px w-24 md:block",
          side === "left"
            ? "after:bg-foreground/30 after:absolute after:top-1/2 after:right-0 after:h-px after:w-2 after:origin-right after:rotate-[35deg]"
            : "after:bg-foreground/30 after:absolute after:top-1/2 after:left-0 after:h-px after:w-2 after:origin-left after:-rotate-[35deg]",
        )}
      />
    </li>
  );
}
