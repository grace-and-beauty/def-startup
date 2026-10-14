import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

import { isNicheSlug, nicheChoices } from "@/config/niches";
import { getOwnerBusiness, requireOwnerSession } from "@/lib/auth/owner";
import { parseCardDraft } from "@/lib/domain/card-draft";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";

import { signOut } from "../actions";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: t("onboarding.title") };

/**
 * 5-step wizard. ?niche=<slug> (from /dlya/[niche] → /login) preselects the
 * niche; the card builder on the home page also brings stamps, reward and the
 * own category (src/lib/domain/card-draft.ts).
 */
export default async function OnboardingPage({ searchParams }: PageProps<"/dashboard/onboarding">) {
  await requireOwnerSession();
  const owned = await getOwnerBusiness();
  if (owned?.business.onboarding_done && owned.program) redirect("/dashboard");

  const draft =
    parseCardDraft(await searchParams) ??
    (owned && isNicheSlug(owned.business.niche_slug) ? { niche: owned.business.niche_slug } : null);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <BrandMark />
          <form action={signOut}>
            <button type="submit" className="text-muted-foreground hover:text-foreground text-sm">
              {t("dashboard.logout")}
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:py-10">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("onboarding.title")}</h1>
        <OnboardingWizard niches={nicheChoices()} draft={draft} siteUrl={siteUrl()} />
      </main>
    </div>
  );
}
