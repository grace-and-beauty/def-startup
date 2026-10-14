import { Check, Minus, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { planLines } from "@/components/plan-cards";
import { PublicShell } from "@/components/public-shell";
import { CANCELED_GRACE_DAYS, PLAN_IDS, PLANS, TRIAL_DAYS, TRIAL_PLAN } from "@/config/plans";
import { accent } from "@/lib/accent";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import "./pricing.css";

export const metadata: Metadata = { title: t("pricing.title") };

const FAQ = [1, 2, 3, 4] as const;

export default function PricingPage() {
  return (
    <PublicShell current="pricing">
      <section className="flex flex-col gap-5">
        <p className="text-ink-muted text-[13px] font-extrabold tracking-[0.1em] uppercase">{t("pricing.eyebrow")}</p>
        <h1 className="font-display max-w-[17ch] text-[clamp(44px,7.4vw,124px)] leading-[1.02] text-balance [&_em]:text-brand [&_em]:not-italic">
          {accent(t("pricing.heroTitle"))}
        </h1>
        <p className="text-ink-muted max-w-xl text-lg leading-relaxed sm:text-xl">{t("pricing.heroText")}</p>
      </section>

      <ul className="grid items-start gap-6 md:grid-cols-3" aria-label={t("pricing.title")}>
        {PLAN_IDS.map((id, i) => {
          const plan = PLANS[id];
          const hot = id === TRIAL_PLAN;
          const soon = !plan.availableInMvp;
          return (
            <li
              key={id}
              className={cn("pr-plan", hot && "pr-plan-hot", soon && "pr-plan-soon")}
              style={{ "--i": i, "--r0": `${[-4, 2, 5][i] ?? 0}deg` } as CSSProperties}
            >
              {hot ? (
                <span className="pr-plan-stamp" aria-hidden>
                  <span>
                    <b className="font-brand">{TRIAL_DAYS}</b>
                    {t("pricing.stamp")}
                  </span>
                </span>
              ) : null}
              <div className="flex flex-col gap-4 p-7 pb-6">
                <h2 className={cn("font-display text-3xl", hot && "pr-20")}>{t(plan.nameKey)}</h2>
                {soon ? <p className="pr-plan-mist -mt-2 text-[15px]">{t("pricing.soon")}</p> : null}
                <p className="flex items-baseline gap-2">
                  <b className="font-display text-[clamp(52px,5vw,72px)] leading-none">{plan.priceUah} ₴</b>
                  <span className="pr-plan-mist font-semibold">{t("pricing.perMonthShort")}</span>
                </p>
                <ul className="flex flex-col gap-2.5 text-[15px]">
                  {planLines(plan).map((line) => (
                    <li key={line} className="flex gap-2.5">
                      {soon ? (
                        <Minus className="mt-0.5 size-4 shrink-0" aria-hidden />
                      ) : (
                        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                      )}
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="pr-plan-perf" />
              <div className="flex flex-col gap-2.5 p-7 pt-5">
                {soon ? (
                  <span className="pr-plan-btn" aria-disabled="true">
                    {t("pricing.soonCta")}
                  </span>
                ) : (
                  <Link href="/login" className="pr-plan-btn">
                    {hot ? t("pricing.plusCta") : t("pricing.basicCta")}
                  </Link>
                )}
                {hot ? <small className="pr-plan-mist text-center text-[13px]">{t("pricing.noCard")}</small> : null}
              </div>
            </li>
          );
        })}
      </ul>

      <section className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-10" aria-labelledby="faq-title">
        <h2
          id="faq-title"
          className="font-display text-[clamp(36px,4.4vw,64px)] leading-[1.02] [&_em]:text-brand [&_em]:not-italic"
        >
          {accent(t("pricing.faqTitle"))}
        </h2>
        <div className="flex flex-col">
          {FAQ.map((n) => (
            <details key={n} className="pr-faq group" open={n === 1}>
              <summary className="font-display flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-xl [&::-webkit-details-marker]:hidden">
                {t(`pricing.faq.q${n}`)}
                <span className="bg-ink-2 group-open:bg-brand group-open:text-brand-foreground grid size-9 shrink-0 place-items-center rounded-full transition-[background,transform] group-open:rotate-45">
                  <Plus className="size-4" aria-hidden />
                </span>
              </summary>
              <p className="text-ink-muted mb-5 max-w-2xl">{t(`pricing.faq.a${n}`, { days: CANCELED_GRACE_DAYS })}</p>
            </details>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
