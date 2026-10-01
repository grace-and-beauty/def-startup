import type { Metadata } from "next";

import { LockedFeature, PageHeader, Section } from "@/components/dashboard/blocks";
import { requireOwnerContext } from "@/lib/auth/owner";
import { hasFeature } from "@/lib/domain/plans";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";

import {
  removeLogo,
  updateBusinessInfo,
  updateDesign,
  updateReminders,
  updateRule,
  uploadLogo,
} from "./actions";
import { BusinessInfoForm, DesignForm, LogoForm, RemindersForm, RuleForm } from "./settings-forms";

export const metadata: Metadata = { title: t("settings.title") };

export default async function SettingsPage() {
  const { business, program, user } = await requireOwnerContext();
  const remindersAllowed = hasFeature(business, "reminders", new Date());

  return (
    <>
      <PageHeader title={t("settings.title")} />

      <Section title={t("settings.designTitle")}>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("settings.slug")}</span>
            <span className="font-mono break-all">{`${siteUrl()}/c/${business.slug}`}</span>
            <span className="text-muted-foreground text-xs">{t("settings.slugNote")}</span>
          </div>
          <DesignForm
            action={updateDesign}
            initial={{
              name: business.name,
              bgColor: business.bg_color,
              fgColor: business.fg_color,
              labelColor: business.label_color,
            }}
            preview={{
              logoUrl: business.logo_url,
              rewardText: program.reward_text,
              stampsRequired: program.stamps_required,
            }}
          />
        </div>
      </Section>

      <Section title={t("settings.logoTitle")}>
        <LogoForm uploadAction={uploadLogo} removeAction={removeLogo} logoUrl={business.logo_url} />
      </Section>

      <Section title={t("settings.ruleTitle")}>
        <RuleForm
          action={updateRule}
          initial={{
            stampsRequired: program.stamps_required,
            rewardText: program.reward_text,
            termsText: program.terms_text ?? "",
          }}
        />
      </Section>

      <div id="reminders" className="scroll-mt-6">
        <Section title={t("settings.remindersTitle")} hint={t("settings.remindersIntro")}>
          {remindersAllowed ? (
            <RemindersForm
              action={updateReminders}
              initial={{
                enabled: program.reminders_enabled,
                days: program.reminder_days,
                text: program.reminder_text ?? "",
              }}
            />
          ) : (
            <LockedFeature title={t("settings.remindersLocked")} />
          )}
        </Section>
      </div>

      <div id="business" className="scroll-mt-6">
        <Section title={t("settings.businessTitle")}>
          <BusinessInfoForm action={updateBusinessInfo} avgCheck={business.avg_check} />
        </Section>
      </div>

      <Section title={t("settings.accountTitle")}>
        <p className="text-sm">{t("settings.email", { email: user.email ?? "—" })}</p>
      </Section>
    </>
  );
}
