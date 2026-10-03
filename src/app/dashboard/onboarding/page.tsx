import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

import { isNicheSlug, listNiches } from "@/config/niches";
import { getOwnerBusiness, requireOwnerSession } from "@/lib/auth/owner";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";

import { signOut } from "../actions";
import { OnboardingWizard } from "./wizard";

export const metadata: Metadata = { title: t("onboarding.title") };

/** 5-step wizard; ?niche=<slug> (from /dlya/[niche] → /login) preselects the niche. */
export default async function OnboardingPage({ searchParams }: PageProps<"/dashboard/onboarding">) {
  await requireOwnerSession();
  const owned = await getOwnerBusiness();
  if (owned?.business.onboarding_done && owned.program) redirect("/dashboard");

  const params = await searchParams;
  const nicheParam = typeof params.niche === "string" ? params.niche : null;
  const initialNiche =
    nicheParam && isNicheSlug(nicheParam)
      ? nicheParam
      : owned && isNicheSlug(owned.business.niche_slug)
        ? owned.business.niche_slug
        : null;

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
        <OnboardingWizard niches={listNiches()} initialNiche={initialNiche} siteUrl={siteUrl()} />
      </main>
    </div>
  );
}
