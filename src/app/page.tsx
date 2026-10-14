import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";

import { HomeStory, type StoryScene, type StoryTexts } from "@/components/home/home-story";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { getNiche, listNiches } from "@/config/niches";
import { PLANS } from "@/config/plans";
import { accent } from "@/lib/accent";
import { t, type TranslationKey } from "@/lib/i18n";

const SCENES = ["s0", "s1", "s2", "s3", "s4", "s5", "s6"] as const;

/** Optional dictionary lines: a scene may have one or two lines on a side. */
function lines(...keys: TranslationKey[]): string[] {
  return keys.map((key) => t(key)).filter((line, i) => line !== keys[i]);
}

function storyTexts(): StoryTexts {
  const scenes: StoryScene[] = SCENES.map((s) => ({
    clock: t(`story.${s}.clock` as TranslationKey),
    word: lines(`story.${s}.word` as TranslationKey)[0],
    left: lines(`story.${s}.l` as TranslationKey, `story.${s}.l2` as TranslationKey),
    right: lines(`story.${s}.r1` as TranslationKey, `story.${s}.r2` as TranslationKey),
    sub: t(`story.${s}.sub` as TranslationKey),
  }));
  const p = (key: string) => t(`story.phone.${key}` as TranslationKey);
  return {
    label: t("story.label"),
    visits: t("story.visits"),
    cue: t("story.cue"),
    cueDesktop: t("story.cueDesktop"),
    cueTouch: t("story.cueTouch"),
    introCaption: t("story.introCaption"),
    scenes,
    leftTemplate: p("left"),
    phone: {
      lockDate: p("lockDate"),
      scanCta: p("scanCta"),
      joinTitle: p("joinTitle"),
      joinLead: p("joinLead"),
      nameLabel: p("nameLabel"),
      nameValue: p("nameValue"),
      phoneLabel: p("phoneLabel"),
      phoneValue: p("phoneValue"),
      consent: p("consent"),
      getCard: p("getCard"),
      visitsOf: p("visitsOf"),
      gift: p("gift"),
      showCode: p("showCode"),
      showCodeHint: p("showCodeHint"),
      notifText: p("notifText"),
      notifTime: p("notifTime"),
      giftTitle: p("giftTitle"),
      giftText: p("giftText"),
      ownerTitle: p("ownerTitle"),
      ownerWho: p("ownerWho"),
      statCards: p("statCards"),
      statBack: p("statBack"),
      statVisits: p("statVisits"),
      statLost: p("statLost"),
      feedRow: p("feedRow"),
      feedMeta: p("feedMeta"),
    },
  };
}

export default function HomePage() {
  const barbershop = getNiche("barbershop") ?? listNiches()[0]!;
  const niches = listNiches();
  const sample = {
    business: barbershop.sampleBusinessName,
    initial: barbershop.sampleBusinessName.replace(/^.*«/, "").charAt(0) || "Т",
    reward: barbershop.rewardText,
    stamps: barbershop.stampsRequired,
  };
  // The marquee runs twice so it can loop; the second copy is hidden from assistive tech.
  const tickets = [...niches, ...niches];

  return (
    <div className="hs-root flex min-h-full flex-1 flex-col">
      <SiteHeader overlay className="hs-header" />
      <main>
        <HomeStory texts={storyTexts()} sample={sample} />

        <section className="hs-who" aria-labelledby="who-title">
          <div className="hs-section">
            <h2 id="who-title" className="hs-big">
              {accent(t("story.whoTitle"))}
            </h2>
            <p className="hs-lead">{t("story.whoText")}</p>
          </div>
          <div className="hs-marquee" aria-label={t("story.whoLabel")}>
            <div className="hs-track">
              {tickets.map((niche, i) => {
                const copy = i >= niches.length;
                const filled = Math.max(1, Math.round(niche.stampsRequired * [0.6, 0.4, 0.7, 0.3, 0.85, 0.2, 0.7, 0.6][i % 8]!));
                return (
                  <Link
                    key={`${niche.slug}-${i}`}
                    href={`/dlya/${niche.slug}`}
                    className={i % 3 === 1 ? "hs-mticket hot" : "hs-mticket"}
                    style={{ "--rot": `${i % 2 ? 1.6 : -1.4}deg` } as CSSProperties}
                    aria-hidden={copy || undefined}
                    tabIndex={copy ? -1 : undefined}
                  >
                    <div className="hs-nm">{niche.sampleBusinessName}</div>
                    <div className="hs-rw">{niche.rewardText}</div>
                    <div className="hs-perf" />
                    <div className="hs-holes">
                      {Array.from({ length: niche.stampsRequired }, (_, k) => (
                        <span key={k} className={k < filled ? "hs-hole on" : "hs-hole"} />
                      ))}
                    </div>
                    <div className="hs-ft">
                      <span>
                        <b>{filled}</b> / {niche.stampsRequired}
                      </span>
                      <span>{niche.name}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        <section className="hs-final hs-section" aria-labelledby="final-title">
          <h2 id="final-title" className="hs-big">
            {accent(t("story.finalTitle"))}
          </h2>
          <p className="hs-lead">{t("story.finalText", { price: PLANS.basic.priceUah })}</p>
          <div className="hs-ctas">
            <Link href="/login" className="hs-cta hs-cta-accent">
              {t("story.finalCta")}
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link href="/pricing" className="hs-cta hs-cta-ghost">
              {t("story.finalPricing")}
            </Link>
          </div>
          <small className="hs-note">{t("story.finalNote")}</small>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
