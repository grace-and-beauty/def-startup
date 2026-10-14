"use client";

import { Check, Minus, Plus } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";

import { CardPreview } from "@/components/card-preview";
import { ColorField } from "@/components/color-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OTHER_NICHE, type Niche, type NicheSlug } from "@/config/niches";
import { normalizeOwnerPhone } from "@/lib/domain/business-input";
import type { CardDraft } from "@/lib/domain/card-draft";
import { isValidSlug, normalizeSlugInput, slugify } from "@/lib/domain/slug";
import { t, type TranslationKey } from "@/lib/i18n";
import { isValidNewPin } from "@/lib/security/pin-format";
import { isAcceptableLogo } from "@/lib/security/upload";
import { cn } from "@/lib/utils";

import { checkSlug, completeOnboarding } from "./actions";
import { FIELD_ERROR_KEYS, FIELD_STEP, type OnboardingField } from "./types";

const STEPS: readonly TranslationKey[] = [
  "onboarding.steps.niche",
  "onboarding.steps.name",
  "onboarding.steps.design",
  "onboarding.steps.rule",
  "onboarding.steps.pin",
];

const HEX = /^#[0-9a-fA-F]{6}$/;

interface WizardProps {
  /** The niches, then «Інше» (nicheChoices()). */
  niches: Niche[];
  /** Preselected niche, and maybe a whole card from the builder on the home page. */
  draft: CardDraft | null;
  siteUrl: string;
}

interface FormState {
  niche: NicheSlug | null;
  /** The owner's own category, with «Інше». */
  nicheLabel: string;
  name: string;
  slug: string;
  slugTouched: boolean;
  contactPhone: string;
  city: string;
  bgColor: string;
  fgColor: string;
  labelColor: string;
  stampsRequired: number;
  rewardText: string;
  termsText: string;
  pin: string;
  pinConfirm: string;
}

function presetFor(niche: Niche | undefined): Partial<FormState> {
  if (!niche) return {};
  return {
    bgColor: niche.colors.bg,
    fgColor: niche.colors.fg,
    labelColor: niche.colors.label,
    stampsRequired: niche.stampsRequired,
    rewardText: niche.rewardText,
    termsText: niche.termsText,
  };
}

type FieldErrors = Partial<Record<OnboardingField, string>>;

export function OnboardingWizard({ niches, draft, siteUrl }: WizardProps) {
  const initial = niches.find((n) => n.slug === draft?.niche);
  // «Інше» without a category name starts on the first step to ask for it.
  const [step, setStep] = useState(initial && (initial.slug !== OTHER_NICHE || draft?.nicheLabel) ? 1 : 0);
  const [form, setForm] = useState<FormState>({
    niche: initial?.slug ?? null,
    nicheLabel: draft?.nicheLabel ?? "",
    name: draft?.businessName ?? "",
    slug: draft?.businessName ? slugify(draft.businessName) : "",
    slugTouched: false,
    contactPhone: "",
    city: "",
    bgColor: "#111111",
    fgColor: "#ffffff",
    labelColor: "#bbbbbb",
    stampsRequired: 6,
    rewardText: "",
    termsText: "",
    pin: "",
    pinConfirm: "",
    ...presetFor(initial),
    ...(draft?.stampsRequired ? { stampsRequired: draft.stampsRequired } : {}),
    ...(draft?.rewardText ? { rewardText: draft.rewardText } : {}),
    ...(draft?.colors
      ? { bgColor: draft.colors.bg, fgColor: draft.colors.fg, labelColor: draft.colors.label }
      : {}),
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [checking, startChecking] = useTransition();
  const [submitting, startSubmitting] = useTransition();

  const niche = niches.find((n) => n.slug === form.niche);

  // Free the object URL of the previous logo preview.
  useEffect(() => {
    if (!logoPreview) return;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function chooseNiche(slug: NicheSlug) {
    // Re-clicking the chosen niche keeps what the owner (or the builder) already set.
    if (slug === form.niche) return;
    update({ niche: slug, ...presetFor(niches.find((n) => n.slug === slug)) });
  }

  function setName(name: string) {
    update(form.slugTouched ? { name } : { name, slug: slugify(name) });
  }

  function chooseLogo(file: File | null) {
    if (file && !isAcceptableLogo(file)) {
      setErrors((e) => ({ ...e, logo: t("onboarding.logoInvalid") }));
      return;
    }
    setErrors((e) => ({ ...e, logo: undefined }));
    setLogo(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  }

  /** Client-side checks of one step; the server re-validates everything. */
  function validate(index: number): FieldErrors {
    const e: FieldErrors = {};
    if (index === 0 && !form.niche) e.niche = t("onboarding.nicheTitle");
    if (index === 0 && form.niche === OTHER_NICHE) {
      const label = form.nicheLabel.replace(/\s+/g, " ").trim();
      if (label.length < 2 || label.length > 60) e.nicheLabel = t("onboarding.nicheLabelInvalid");
    }
    if (index === 1) {
      const name = form.name.trim();
      if (name.length < 1 || name.length > 80) e.name = t("onboarding.nameInvalid");
      if (!isValidSlug(form.slug)) e.slug = t("onboarding.slugInvalid");
      if (!normalizeOwnerPhone(form.contactPhone)) e.contactPhone = t("onboarding.contactPhoneInvalid");
      const city = form.city.trim();
      if (city.length < 1 || city.length > 60) e.city = t("onboarding.cityInvalid");
    }
    if (index === 2) {
      if (!HEX.test(form.bgColor)) e.bgColor = t("onboarding.colorInvalid");
      if (!HEX.test(form.fgColor)) e.fgColor = t("onboarding.colorInvalid");
      if (!HEX.test(form.labelColor)) e.labelColor = t("onboarding.colorInvalid");
    }
    if (index === 3) {
      if (!Number.isInteger(form.stampsRequired) || form.stampsRequired < 2 || form.stampsRequired > 20) {
        e.stampsRequired = t("onboarding.stampsInvalid");
      }
      const reward = form.rewardText.trim();
      if (reward.length < 1 || reward.length > 120) e.rewardText = t("onboarding.rewardInvalid");
      if (form.termsText.trim().length > 1000) e.termsText = t("onboarding.termsInvalid");
    }
    if (index === 4) {
      if (!isValidNewPin(form.pin)) e.pin = t("onboarding.pinInvalid");
      else if (form.pin !== form.pinConfirm) e.pinConfirm = t("onboarding.pinMismatch");
    }
    return e;
  }

  function next() {
    const e = validate(step);
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length > 0) return;
    if (step !== 1) {
      setStep(step + 1);
      return;
    }
    startChecking(async () => {
      const result = await checkSlug(form.slug);
      if (result.status === "ok") {
        setSuggestions([]);
        setStep(2);
      } else if (result.status === "taken") {
        setErrors({ slug: t("onboarding.slugTaken") });
        setSuggestions(result.suggestions);
      } else if (result.status === "invalid") {
        setErrors({ slug: t("onboarding.slugInvalid") });
      } else {
        setFormError(t("dashboard.sessionExpired"));
      }
    });
  }

  function submit() {
    const e = validate(4);
    setErrors(e);
    setFormError(null);
    if (Object.keys(e).length > 0) return;

    const data = new FormData();
    data.set("niche", form.niche ?? "");
    data.set("nicheLabel", form.niche === OTHER_NICHE ? form.nicheLabel : "");
    data.set("name", form.name);
    data.set("slug", form.slug);
    data.set("contactPhone", form.contactPhone);
    data.set("city", form.city);
    data.set("bgColor", form.bgColor);
    data.set("fgColor", form.fgColor);
    data.set("labelColor", form.labelColor);
    data.set("stampsRequired", String(form.stampsRequired));
    data.set("rewardText", form.rewardText);
    data.set("termsText", form.termsText);
    data.set("pin", form.pin);
    data.set("pinConfirm", form.pinConfirm);
    if (logo) data.set("logo", logo);

    startSubmitting(async () => {
      // On success the action redirects to /dashboard/onboarding/done.
      const result = await completeOnboarding(data);
      if (!result || result.status !== "error") return;
      if ("field" in result) {
        setErrors({
          [result.field]: t(result.reason === "slugTaken" ? "onboarding.slugTaken" : FIELD_ERROR_KEYS[result.field]),
        });
        setSuggestions(result.reason === "slugTaken" ? result.suggestions : []);
        setStep(FIELD_STEP[result.field]);
      } else {
        setFormError(t(result.reason === "sessionExpired" ? "dashboard.sessionExpired" : "common.error"));
      }
    });
  }

  const preview = (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">{t("onboarding.preview")}</span>
      <CardPreview
        businessName={form.name.trim() || niche?.sampleBusinessName || "—"}
        logoUrl={logoPreview}
        bgColor={HEX.test(form.bgColor) ? form.bgColor : "#111111"}
        fgColor={HEX.test(form.fgColor) ? form.fgColor : "#ffffff"}
        labelColor={HEX.test(form.labelColor) ? form.labelColor : "#bbbbbb"}
        rewardText={form.rewardText.trim() || niche?.rewardText || "—"}
        stampsRequired={Math.min(Math.max(form.stampsRequired || 2, 2), 20)}
        stampsCount={Math.max(1, Math.min(form.stampsRequired, 20) - 2)}
        customerName={niche?.landing.sampleCustomerName ?? t("onboarding.previewCustomer")}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex gap-1" aria-label={t("onboarding.stepOf", { step: step + 1, total: STEPS.length })}>
        {STEPS.map((key, i) => (
          <li key={key} className="flex flex-1 flex-col gap-1">
            <span className={cn("h-1 rounded-full", i <= step ? "bg-foreground" : "bg-muted")} />
            <span
              className={cn("hidden text-xs sm:block", i === step ? "font-medium" : "text-muted-foreground")}
              aria-current={i === step ? "step" : undefined}
            >
              {t(key)}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-muted-foreground text-sm sm:hidden">
        {t("onboarding.stepOf", { step: step + 1, total: STEPS.length })} · {t(STEPS[step])}
      </p>

      <div className="grid gap-8 md:grid-cols-[1fr_minmax(0,18rem)]">
        <div className="flex min-w-0 flex-col gap-5">
          {step === 0 ? (
            <StepBlock title={t("onboarding.nicheTitle")} hint={t("onboarding.nicheHint")}>
              <div role="radiogroup" aria-label={t("onboarding.nicheTitle")} className="grid grid-cols-2 gap-2">
                {niches.map((n) => {
                  const selected = form.niche === n.slug;
                  const other = n.slug === OTHER_NICHE;
                  return (
                    <button
                      key={n.slug}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => chooseNiche(n.slug)}
                      className={cn(
                        "hover:border-foreground/40 flex min-w-0 items-start justify-between gap-2 rounded-lg border p-3 text-left transition-colors",
                        other && "col-span-2 border-dashed",
                        selected && "border-foreground ring-foreground border-solid ring-1",
                      )}
                    >
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">{n.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {other ? t("onboarding.nicheOtherHint") : n.rewardText}
                        </span>
                      </span>
                      {selected ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
              {form.niche === OTHER_NICHE ? (
                <Field id="nicheLabel" label={t("onboarding.nicheLabel")} error={errors.nicheLabel}>
                  <Input
                    id="nicheLabel"
                    value={form.nicheLabel}
                    maxLength={60}
                    autoFocus={!form.nicheLabel}
                    placeholder={t("onboarding.nicheLabelPlaceholder")}
                    onChange={(e) => update({ nicheLabel: e.target.value })}
                    aria-invalid={Boolean(errors.nicheLabel)}
                  />
                </Field>
              ) : null}
              <FieldError message={errors.niche} />
            </StepBlock>
          ) : null}

          {step === 1 ? (
            <StepBlock title={t("onboarding.nameTitle")}>
              <Field id="name" label={t("onboarding.name")} error={errors.name}>
                <Input
                  id="name"
                  value={form.name}
                  maxLength={80}
                  autoComplete="organization"
                  placeholder={
                    niche && niche.slug !== OTHER_NICHE
                      ? t("onboarding.namePlaceholder", { example: niche.sampleBusinessName })
                      : t("onboarding.namePlaceholderOther")
                  }
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={Boolean(errors.name)}
                  className="h-11 text-base"
                />
              </Field>
              <Field
                id="slug"
                label={t("onboarding.slug")}
                error={errors.slug}
                hint={t("onboarding.slugHint", { url: `${siteUrl}/c/${form.slug || "…"}` })}
              >
                <Input
                  id="slug"
                  value={form.slug}
                  maxLength={40}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(e) => update({ slug: normalizeSlugInput(e.target.value), slugTouched: true })}
                  aria-invalid={Boolean(errors.slug)}
                  className="h-11 font-mono text-base"
                />
              </Field>
              {suggestions.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">{t("onboarding.slugSuggestions")}</span>
                  {suggestions.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="font-mono"
                      onClick={() => {
                        update({ slug: s, slugTouched: true });
                        setErrors({});
                        setSuggestions([]);
                      }}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              ) : null}
              <Field id="contactPhone" label={t("onboarding.contactPhone")} error={errors.contactPhone} hint={t("onboarding.contactPhoneHint")}>
                <Input
                  id="contactPhone"
                  type="tel"
                  inputMode="tel"
                  value={form.contactPhone}
                  maxLength={20}
                  autoComplete="tel"
                  placeholder={t("onboarding.contactPhonePlaceholder")}
                  onChange={(e) => update({ contactPhone: e.target.value })}
                  aria-invalid={Boolean(errors.contactPhone)}
                  className="h-11 text-base"
                />
              </Field>
              <Field id="city" label={t("onboarding.city")} error={errors.city}>
                <Input
                  id="city"
                  value={form.city}
                  maxLength={60}
                  autoComplete="address-level2"
                  placeholder={t("onboarding.cityPlaceholder")}
                  onChange={(e) => update({ city: e.target.value })}
                  aria-invalid={Boolean(errors.city)}
                  className="h-11 text-base"
                />
              </Field>
            </StepBlock>
          ) : null}

          {step === 2 ? (
            <StepBlock title={t("onboarding.designTitle")}>
              <Field id="logo" label={t("onboarding.logo")} hint={t("onboarding.logoHint")} error={errors.logo}>
                <div className="flex items-center gap-2">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => chooseLogo(e.target.files?.[0] ?? null)}
                    className="h-11"
                  />
                  {logo ? (
                    <Button type="button" variant="ghost" size="sm" onClick={() => chooseLogo(null)}>
                      {t("onboarding.logoRemove")}
                    </Button>
                  ) : null}
                </div>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <ColorField
                  id="bgColor"
                  label={t("onboarding.bgColor")}
                  value={form.bgColor}
                  error={errors.bgColor}
                  onChange={(bgColor) => update({ bgColor })}
                />
                <ColorField
                  id="fgColor"
                  label={t("onboarding.fgColor")}
                  value={form.fgColor}
                  error={errors.fgColor}
                  onChange={(fgColor) => update({ fgColor })}
                />
                <ColorField
                  id="labelColor"
                  label={t("onboarding.labelColor")}
                  value={form.labelColor}
                  error={errors.labelColor}
                  onChange={(labelColor) => update({ labelColor })}
                />
              </div>
            </StepBlock>
          ) : null}

          {step === 3 ? (
            <StepBlock title={t("onboarding.ruleTitle")}>
              <Field id="stampsRequired" label={t("onboarding.stampsRequired")} error={errors.stampsRequired}>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="−1"
                    onClick={() => update({ stampsRequired: Math.max(2, form.stampsRequired - 1) })}
                  >
                    <Minus aria-hidden />
                  </Button>
                  <Input
                    id="stampsRequired"
                    type="number"
                    inputMode="numeric"
                    min={2}
                    max={20}
                    value={Number.isNaN(form.stampsRequired) ? "" : form.stampsRequired}
                    onChange={(e) => update({ stampsRequired: e.target.valueAsNumber })}
                    aria-invalid={Boolean(errors.stampsRequired)}
                    className="h-11 w-20 text-center text-base"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="+1"
                    onClick={() => update({ stampsRequired: Math.min(20, (form.stampsRequired || 1) + 1) })}
                  >
                    <Plus aria-hidden />
                  </Button>
                </div>
              </Field>
              <Field id="rewardText" label={t("onboarding.rewardText")} error={errors.rewardText}>
                <Input
                  id="rewardText"
                  value={form.rewardText}
                  maxLength={120}
                  onChange={(e) => update({ rewardText: e.target.value })}
                  aria-invalid={Boolean(errors.rewardText)}
                  className="h-11 text-base"
                />
              </Field>
              <Field id="termsText" label={t("onboarding.termsText")} error={errors.termsText}>
                <Textarea
                  id="termsText"
                  value={form.termsText}
                  maxLength={1000}
                  rows={3}
                  onChange={(e) => update({ termsText: e.target.value })}
                  aria-invalid={Boolean(errors.termsText)}
                />
              </Field>
            </StepBlock>
          ) : null}

          {step === 4 ? (
            <StepBlock
              title={t("onboarding.pinTitle")}
              hint={t("onboarding.pinHint", { name: t("onboarding.defaultStaffName") })}
            >
              <Field id="pin" label={t("onboarding.pin")} error={errors.pin}>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={form.pin}
                  onChange={(e) => update({ pin: e.target.value.replace(/\D/g, "") })}
                  aria-invalid={Boolean(errors.pin)}
                  className="h-11 w-40 text-center text-lg tracking-widest"
                />
              </Field>
              <Field id="pinConfirm" label={t("onboarding.pinConfirm")} error={errors.pinConfirm}>
                <Input
                  id="pinConfirm"
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  maxLength={6}
                  value={form.pinConfirm}
                  onChange={(e) => update({ pinConfirm: e.target.value.replace(/\D/g, "") })}
                  aria-invalid={Boolean(errors.pinConfirm)}
                  className="h-11 w-40 text-center text-lg tracking-widest"
                />
              </Field>
            </StepBlock>
          ) : null}

          {formError ? (
            <p role="alert" className="text-destructive text-sm">
              {formError}
            </p>
          ) : null}

          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setErrors({});
                  setStep(step - 1);
                }}
                disabled={submitting}
              >
                {t("common.back")}
              </Button>
            ) : null}
            {step < STEPS.length - 1 ? (
              <Button type="button" size="lg" className="flex-1 sm:flex-none" onClick={next} disabled={checking}>
                {checking ? t("onboarding.checking") : t("common.next")}
              </Button>
            ) : (
              <Button type="button" size="lg" className="flex-1 sm:flex-none" onClick={submit} disabled={submitting}>
                {submitting ? t("onboarding.finishing") : t("onboarding.finish")}
              </Button>
            )}
          </div>
        </div>

        {step > 0 ? <aside className="order-first md:order-none">{preview}</aside> : null}
      </div>
    </div>
  );
}

function StepBlock({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-bold tracking-tight">{title}</h2>
        {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-destructive text-sm">
      {message}
    </p>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs break-all">{hint}</p> : null}
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}
