import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { LockedFeature, PageHeader, Section, StatCard } from "@/components/dashboard/blocks";
import { Button } from "@/components/ui/button";
import { requireOwnerContext } from "@/lib/auth/owner";
import { analyticsDaily, countCards } from "@/lib/data";
import { change, repeatShare, sumDaily } from "@/lib/domain/analytics";
import { monthToDateComparison, parseLocalDate, toLocalDate } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { siteUrl } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("overview.title") };

export default async function DashboardHomePage() {
  const { supabase, business } = await requireOwnerContext();
  const now = new Date();
  const today = toLocalDate(now, business.timezone);
  const { current, previous } = monthToDateComparison(today);

  const [daily, totalCards] = await Promise.all([
    analyticsDaily(supabase, business.id, previous.from, current.to),
    countCards(supabase, business.id),
  ]);
  const thisMonth = sumDaily(daily, current);
  const lastMonth = sumDaily(daily, previous);
  const share = repeatShare(thisMonth);
  const analyticsEnabled = hasFeature(business, "analytics", now);

  const joinUrl = `${siteUrl()}/c/${business.slug}`;
  const scanUrl = `${siteUrl()}/scan/${business.slug}`;

  return (
    <>
      <PageHeader title={t("overview.title")} description={business.name} />

      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("overview.cardsIssued")}
            value={formatNumber(totalCards)}
            hint={t("overview.cardsIssuedHint", { count: formatNumber(thisMonth.newCards) })}
            delta={change(thisMonth.newCards, lastMonth.newCards)}
          />
          <StatCard
            label={t("overview.stamps")}
            value={formatNumber(thisMonth.stamps)}
            delta={change(thisMonth.stamps, lastMonth.stamps)}
          />
          <StatCard
            label={t("overview.repeatVisits")}
            value={formatNumber(thisMonth.repeatVisits)}
            hint={
              share === null || thisMonth.repeatVisits === 0
                ? t("overview.repeatVisitsHintNone")
                : t("overview.repeatVisitsHint", { pct: share })
            }
            delta={change(thisMonth.repeatVisits, lastMonth.repeatVisits)}
          />
          <StatCard
            label={t("overview.rewards")}
            value={formatNumber(thisMonth.rewards)}
            delta={change(thisMonth.rewards, lastMonth.rewards)}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {t("overview.comparisonNote", { day: parseLocalDate(today).day })}
        </p>
      </section>

      {thisMonth.stamps === 0 && totalCards === 0 ? (
        <p className="bg-muted rounded-lg p-4 text-sm">{t("overview.empty")}</p>
      ) : null}

      {analyticsEnabled ? (
        <div className="bg-muted flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">{t("overview.analyticsTeaser")}</p>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/dashboard/analytics">{t("overview.analyticsOpen")}</Link>
          </Button>
        </div>
      ) : (
        <LockedFeature title={t("analytics.lockedTitle")} text={t("overview.analyticsTeaser")} />
      )}

      <Section title={t("overview.linksTitle")}>
        <ul className="flex flex-col divide-y">
          {[
            { label: t("overview.joinLink"), url: joinUrl },
            { label: t("overview.scanLink"), url: scanUrl },
          ].map((link) => (
            <li key={link.url} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">{link.label}</span>
                <span className="text-muted-foreground truncate font-mono text-xs">{link.url}</span>
              </div>
              <div className="flex shrink-0 gap-2">
                <CopyButton value={link.url} />
                <Button asChild variant="outline" size="sm">
                  <a href={link.url} target="_blank" rel="noreferrer">
                    <ExternalLink aria-hidden />
                    {t("overview.open")}
                  </a>
                </Button>
              </div>
            </li>
          ))}
          <li className="flex flex-col gap-2 py-3 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">{t("overview.posterLink")}</span>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/dashboard/poster">{t("overview.open")}</Link>
            </Button>
          </li>
        </ul>
      </Section>
    </>
  );
}
