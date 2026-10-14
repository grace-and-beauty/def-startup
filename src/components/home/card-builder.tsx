"use client";

import { ArrowRight, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CardPreview } from "@/components/card-preview";
import { OTHER_NICHE, type NicheColors, type NicheSlug } from "@/config/niches";
import { cardDraftQuery, type CardDraft } from "@/lib/domain/card-draft";
import { t, type TranslationKey } from "@/lib/i18n";

/** What the builder needs of a niche (serializable: passed from the server page). */
export interface BuilderChoice {
  slug: NicheSlug;
  name: string;
  sampleBusinessName: string;
  rewardText: string;
  stampsRequired: number;
  colors: NicheColors;
  customerName: string;
}

type CardColors = NonNullable<CardDraft["colors"]>;

/** Card colours to try besides the niche's own (index 0 in the swatch row). */
const PALETTE: readonly { key: TranslationKey; colors: CardColors }[] = [
  { key: "builder.colorOrange", colors: { bg: "#ff9a3c", fg: "#2a0f00", label: "#7a3a00" } },
  { key: "builder.colorGraphite", colors: { bg: "#141414", fg: "#ffffff", label: "#a3a3a3" } },
  { key: "builder.colorViolet", colors: { bg: "#5b21b6", fg: "#faf5ff", label: "#c4b5fd" } },
  { key: "builder.colorForest", colors: { bg: "#14532d", fg: "#f0fdf4", label: "#86efac" } },
  { key: "builder.colorSea", colors: { bg: "#1e3a8a", fg: "#eff6ff", label: "#93c5fd" } },
  { key: "builder.colorPaper", colors: { bg: "#f4efe6", fg: "#2c1236", label: "#8a6f7f" } },
];

const MIN_STAMPS = 2;
const MAX_STAMPS = 20;

/**
 * «Зберіть свою картку» on the home page: category, name, any reward, any
 * number of stamps and a colour, with the live card next to it. The CTA
 * carries the card through /login into the wizard (src/lib/domain/card-draft.ts).
 */
export function CardBuilder({ choices, initial }: { choices: BuilderChoice[]; initial: NicheSlug }) {
  const start = choices.find((c) => c.slug === initial) ?? choices[0]!;
  const [slug, setSlug] = useState<NicheSlug>(start.slug);
  const [label, setLabel] = useState("");
  const [name, setName] = useState("");
  const [reward, setReward] = useState(start.rewardText);
  const [stamps, setStamps] = useState(start.stampsRequired);
  // 0 = the niche's own colours, then PALETTE.
  const [swatch, setSwatch] = useState(0);

  const niche = choices.find((c) => c.slug === slug) ?? choices[0]!;
  const other = slug === OTHER_NICHE;
  const swatches: { key: TranslationKey; colors: CardColors }[] = [
    { key: "builder.colorNiche", colors: { bg: niche.colors.bg, fg: niche.colors.fg, label: niche.colors.label } },
    ...PALETTE,
  ];
  const colors = (swatches[swatch] ?? swatches[0]!).colors;

  function choose(next: BuilderChoice) {
    if (next.slug === slug) return;
    setSlug(next.slug);
    setReward(next.rewardText);
    setStamps(next.stampsRequired);
    setSwatch(0);
  }

  const draft: CardDraft = {
    niche: slug,
    stampsRequired: stamps,
    rewardText: reward.trim() || undefined,
    nicheLabel: other ? label.trim() || undefined : undefined,
    businessName: name.trim() || undefined,
    colors: swatch === 0 ? undefined : colors,
  };
  const shownName = name.trim() || (other && label.trim() ? label.trim() : niche.sampleBusinessName);

  return (
    <div className="hs-bld">
      <div className="hs-bld-card">
        <span className="hs-bld-label">{t("onboarding.preview")}</span>
        <CardPreview
          businessName={shownName}
          bgColor={colors.bg}
          fgColor={colors.fg}
          labelColor={colors.label}
          rewardText={reward.trim() || niche.rewardText}
          stampsRequired={stamps}
          stampsCount={Math.max(1, stamps - 2)}
          customerName={niche.customerName}
        />
      </div>

      <div className="hs-bld-form">
        <fieldset className="hs-bld-field">
          <legend className="hs-bld-label">{t("builder.category")}</legend>
          <div role="radiogroup" aria-label={t("builder.category")} className="hs-chips">
            {choices.map((c) => (
              <button
                key={c.slug}
                type="button"
                role="radio"
                aria-checked={c.slug === slug}
                className={c.slug === OTHER_NICHE ? "hs-chip hs-chip-other" : "hs-chip"}
                onClick={() => choose(c)}
              >
                {c.name}
              </button>
            ))}
          </div>
          {other ? (
            <input
              id="builder-label"
              className="hs-input"
              value={label}
              maxLength={60}
              aria-label={t("onboarding.nicheLabel")}
              placeholder={t("onboarding.nicheLabelPlaceholder")}
              onChange={(e) => setLabel(e.target.value)}
            />
          ) : null}
        </fieldset>

        <div className="hs-bld-field">
          <label htmlFor="builder-name" className="hs-bld-label">
            {t("builder.name")}
          </label>
          <input
            id="builder-name"
            className="hs-input"
            value={name}
            maxLength={80}
            autoComplete="organization"
            placeholder={other ? t("onboarding.namePlaceholderOther") : niche.sampleBusinessName}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="hs-bld-field">
          <label htmlFor="builder-reward" className="hs-bld-label">
            {t("builder.reward")}
          </label>
          <input
            id="builder-reward"
            className="hs-input"
            value={reward}
            maxLength={120}
            placeholder={niche.rewardText}
            onChange={(e) => setReward(e.target.value)}
          />
        </div>

        <div className="hs-bld-field">
          <span id="builder-stamps" className="hs-bld-label">
            {t("onboarding.stampsRequired")}
          </span>
          <div className="hs-stepper" role="group" aria-labelledby="builder-stamps">
            <button
              type="button"
              className="hs-step-btn"
              aria-label={t("builder.fewer")}
              disabled={stamps <= MIN_STAMPS}
              onClick={() => setStamps((n) => Math.max(MIN_STAMPS, n - 1))}
            >
              <Minus className="size-5" aria-hidden />
            </button>
            <output className="hs-step-val" aria-live="polite">
              {stamps}
            </output>
            <button
              type="button"
              className="hs-step-btn"
              aria-label={t("builder.more")}
              disabled={stamps >= MAX_STAMPS}
              onClick={() => setStamps((n) => Math.min(MAX_STAMPS, n + 1))}
            >
              <Plus className="size-5" aria-hidden />
            </button>
          </div>
        </div>

        <div className="hs-bld-field">
          <span className="hs-bld-label">{t("builder.color")}</span>
          <div role="radiogroup" aria-label={t("builder.color")} className="hs-swatches">
            {swatches.map(({ key, colors: c }, i) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={i === swatch}
                aria-label={t(key)}
                className="hs-swatch"
                style={{ background: `linear-gradient(135deg, ${c.bg} 58%, ${c.label} 58%)` }}
                onClick={() => setSwatch(i)}
              />
            ))}
          </div>
        </div>

        <div className="hs-bld-go">
          <Link href={`/login?${cardDraftQuery(draft)}`} className="hs-cta hs-cta-accent">
            {t("builder.cta")}
            <ArrowRight className="size-5" aria-hidden />
          </Link>
          <small className="hs-bld-note">{t("builder.note")}</small>
        </div>
      </div>
    </div>
  );
}
