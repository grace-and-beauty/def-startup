import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { BrandMark } from "@/components/brand-mark";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CardPreview } from "@/components/card-preview";
import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { getOwnerBusiness, requireOwnerSession } from "@/lib/auth/owner";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("onboarding.doneTitle") };

/** Step 6 of the wizard: links to the poster, scanner and join page. */
export default async function OnboardingDonePage({ searchParams }: PageProps<"/dashboard/onboarding/done">) {
  await requireOwnerSession();
  const owned = await getOwnerBusiness();
  if (!owned?.business.onboarding_done || !owned.program) redirect("/dashboard/onboarding");
  const { business, program } = owned;
  const logoFailed = (await searchParams).logo === "failed";

  const scanUrl = `${siteUrl()}/scan/${business.slug}`;
  const joinUrl = `${siteUrl()}/c/${business.slug}`;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-3xl items-center px-4 py-3">
          <BrandMark />
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-3xl flex-1 gap-8 px-4 py-8 md:grid-cols-[1fr_minmax(0,16rem)]">
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <CheckCircle2 className="text-success size-10" aria-hidden />
            <h1 className="font-display text-2xl font-bold tracking-tight">{t("onboarding.doneTitle")}</h1>
            <p className="text-muted-foreground">{t("onboarding.doneText")}</p>
          </div>
          {logoFailed ? (
            <p role="alert" className="bg-muted rounded-lg p-3 text-sm">
              {t("onboarding.logoFailed")}
            </p>
          ) : null}

          <Button asChild size="lg" className="h-12 text-base">
            <Link href="/dashboard/poster">{t("onboarding.donePoster")}</Link>
          </Button>

          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <span className="font-medium">{t("onboarding.doneScanner")}</span>
            <span className="text-muted-foreground text-sm">{t("onboarding.doneScannerHint")}</span>
            <span className="font-mono text-sm break-all">{scanUrl}</span>
            <div>
              <CopyButton value={scanUrl} />
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-4">
            <span className="font-medium">{t("onboarding.doneJoin")}</span>
            <span className="font-mono text-sm break-all">{joinUrl}</span>
            <div>
              <CopyButton value={joinUrl} />
            </div>
          </div>

          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">{t("onboarding.doneDashboard")}</Link>
          </Button>
        </section>

        <aside className="order-first md:order-none">
          <CardPreview
            businessName={business.name}
            logoUrl={business.logo_url}
            bgColor={business.bg_color}
            fgColor={business.fg_color}
            labelColor={business.label_color}
            rewardText={program.reward_text}
            stampsRequired={program.stamps_required}
            stampsCount={0}
          />
        </aside>
      </main>
    </div>
  );
}
