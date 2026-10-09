"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { CardPreview } from "@/components/card-preview";
import { ColorField } from "@/components/color-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { t, type TranslationKey } from "@/lib/i18n";

import { SETTINGS_ERROR_KEYS, type SettingsState } from "./types";

type FormAction = (state: SettingsState, formData: FormData) => Promise<SettingsState>;

function useSettingsAction(action: FormAction, successKey: TranslationKey = "dashboard.saved") {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  useEffect(() => {
    if (state.status === "ok") toast.success(t(successKey));
  }, [state, successKey]);
  const error = state.status === "error" ? t(SETTINGS_ERROR_KEYS[state.reason]) : null;
  return { formAction, pending, error };
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-destructive text-sm">
      {error}
    </p>
  ) : null;
}

function SaveButton({ pending }: { pending: boolean }) {
  return (
    <Button type="submit" className="self-start" disabled={pending}>
      {pending ? t("common.loading") : t("common.save")}
    </Button>
  );
}

// ---------------------------------------------------------------------------

interface DesignFormProps {
  action: FormAction;
  initial: { name: string; bgColor: string; fgColor: string; labelColor: string };
  preview: { logoUrl: string | null; rewardText: string; stampsRequired: number };
}

/** Name + colors with a live card preview. */
export function DesignForm({ action, initial, preview }: DesignFormProps) {
  const { formAction, pending, error } = useSettingsAction(action);
  const [values, setValues] = useState(initial);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,16rem)]">
      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="business-name">{t("onboarding.name")}</Label>
          <Input
            id="business-name"
            name="name"
            required
            maxLength={80}
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
            className="h-10"
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ColorField
            id="bgColor"
            name="bgColor"
            label={t("onboarding.bgColor")}
            value={values.bgColor}
            onChange={(bgColor) => setValues({ ...values, bgColor })}
          />
          <ColorField
            id="fgColor"
            name="fgColor"
            label={t("onboarding.fgColor")}
            value={values.fgColor}
            onChange={(fgColor) => setValues({ ...values, fgColor })}
          />
          <ColorField
            id="labelColor"
            name="labelColor"
            label={t("onboarding.labelColor")}
            value={values.labelColor}
            onChange={(labelColor) => setValues({ ...values, labelColor })}
          />
        </div>
        <ErrorText error={error} />
        <SaveButton pending={pending} />
      </form>
      <CardPreview
        businessName={values.name.trim() || initial.name}
        logoUrl={preview.logoUrl}
        bgColor={values.bgColor}
        fgColor={values.fgColor}
        labelColor={values.labelColor}
        rewardText={preview.rewardText}
        stampsRequired={preview.stampsRequired}
        stampsCount={Math.max(1, preview.stampsRequired - 2)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function LogoForm({
  uploadAction,
  removeAction,
  logoUrl,
}: {
  uploadAction: FormAction;
  removeAction: (state: SettingsState) => Promise<SettingsState>;
  logoUrl: string | null;
}) {
  const upload = useSettingsAction(uploadAction, "settings.logoSaved");
  const remove = useSettingsAction(removeAction, "settings.logoRemoved");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- owner-uploaded logo from Storage
          <img src={logoUrl} alt="" className="size-16 rounded-full border object-cover" />
        ) : (
          <span className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full text-xs">
            {t("card.noLogo")}
          </span>
        )}
        {logoUrl ? (
          <form action={remove.formAction}>
            <Button type="submit" variant="ghost" size="sm" disabled={remove.pending}>
              {t("settings.logoRemove")}
            </Button>
          </form>
        ) : null}
      </div>
      <form action={upload.formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="logo">{t("settings.logoUpload")}</Label>
          <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" required className="h-10" />
          <p className="text-muted-foreground text-xs">{t("onboarding.logoHint")}</p>
        </div>
        <Button type="submit" disabled={upload.pending} className="sm:mb-6">
          {upload.pending ? t("settings.logoUploading") : t("settings.logoUpload")}
        </Button>
      </form>
      <ErrorText error={upload.error ?? remove.error} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function RuleForm({
  action,
  initial,
}: {
  action: FormAction;
  initial: { stampsRequired: number; rewardText: string; termsText: string };
}) {
  const { formAction, pending, error } = useSettingsAction(action);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="stampsRequired">{t("onboarding.stampsRequired")}</Label>
        <Input
          id="stampsRequired"
          name="stampsRequired"
          type="number"
          inputMode="numeric"
          min={2}
          max={20}
          required
          defaultValue={initial.stampsRequired}
          className="h-10 w-24"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="rewardText">{t("onboarding.rewardText")}</Label>
        <Input id="rewardText" name="rewardText" required maxLength={120} defaultValue={initial.rewardText} className="h-10" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="termsText">{t("onboarding.termsText")}</Label>
        <Textarea id="termsText" name="termsText" rows={3} maxLength={1000} defaultValue={initial.termsText} />
      </div>
      <p className="text-muted-foreground text-xs">{t("settings.ruleNote")}</p>
      <ErrorText error={error} />
      <SaveButton pending={pending} />
    </form>
  );
}

// ---------------------------------------------------------------------------

export function RemindersForm({
  action,
  initial,
}: {
  action: FormAction;
  initial: { enabled: boolean; days: number | null; text: string };
}) {
  const { formAction, pending, error } = useSettingsAction(action);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="enabled" defaultChecked={initial.enabled} className="size-4" />
        {t("settings.remindersEnabled")}
      </label>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reminderDays">{t("settings.reminderDays")}</Label>
        <Input
          id="reminderDays"
          name="reminderDays"
          type="number"
          inputMode="numeric"
          min={1}
          max={365}
          defaultValue={initial.days ?? ""}
          className="h-10 w-24"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="reminderText">{t("settings.reminderText")}</Label>
        <Input id="reminderText" name="reminderText" maxLength={120} defaultValue={initial.text} className="h-10" />
      </div>
      <ErrorText error={error} />
      <SaveButton pending={pending} />
    </form>
  );
}

// ---------------------------------------------------------------------------

export function BusinessInfoForm({ action, avgCheck }: { action: FormAction; avgCheck: number | null }) {
  const { formAction, pending, error } = useSettingsAction(action);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="avgCheck">{t("settings.avgCheck")}</Label>
        <Input
          id="avgCheck"
          name="avgCheck"
          type="number"
          inputMode="numeric"
          min={0}
          max={1000000}
          step={1}
          defaultValue={avgCheck ?? ""}
          className="h-10 w-40"
        />
        <p className="text-muted-foreground text-xs">{t("settings.avgCheckHint")}</p>
      </div>
      <ErrorText error={error} />
      <SaveButton pending={pending} />
    </form>
  );
}

/** Owner's phone and city (asked in the wizard; older businesses add them here). */
export function ContactsForm({
  action,
  contactPhone,
  city,
}: {
  action: FormAction;
  contactPhone: string | null;
  city: string | null;
}) {
  const { formAction, pending, error } = useSettingsAction(action);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="contactPhone">{t("onboarding.contactPhone")}</Label>
        <Input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          required
          defaultValue={contactPhone ?? ""}
          placeholder={t("onboarding.contactPhonePlaceholder")}
          className="h-10 max-w-xs"
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="city">{t("onboarding.city")}</Label>
        <Input
          id="city"
          name="city"
          autoComplete="address-level2"
          maxLength={60}
          required
          defaultValue={city ?? ""}
          placeholder={t("onboarding.cityPlaceholder")}
          className="h-10 max-w-xs"
        />
      </div>
      <ErrorText error={error} />
      <SaveButton pending={pending} />
    </form>
  );
}
