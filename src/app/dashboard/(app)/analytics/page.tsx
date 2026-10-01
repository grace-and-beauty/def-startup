import type { Metadata } from "next";
import Link from "next/link";

import { LockedFeature, PageHeader } from "@/components/dashboard/blocks";
import { requireOwnerContext } from "@/lib/auth/owner";
import { analyticsCardStats, analyticsDaily, analyticsHeatmap, analyticsStaff, listMessages } from "@/lib/data";
import { toLocalDate } from "@/lib/domain/dates";
import { hasFeature } from "@/lib/domain/plans";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { AnalyticsView } from "./analytics-view";
import { analyticsQueryRange, buildAnalyticsModel, parsePeriod, PERIODS } from "./model";
import { sampleAnalyticsInputs } from "./sample";

export const metadata: Metadata = { title: t("analytics.title") };

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const { supabase, business } = await requireOwnerContext();
  const period = parsePeriod((await searchParams).period);
  const now = new Date();
  const today = toLocalDate(now, business.timezone);

  const periodSwitch = (
    <nav aria-label={t("analytics.period")} className="bg-muted flex rounded-lg p-1">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`/dashboard/analytics?period=${p}`}
          aria-current={p === period ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm",
            p === period ? "bg-background font-medium shadow-xs" : "text-muted-foreground",
          )}
        >
          {t("analytics.periodDays", { days: p })}
        </Link>
      ))}
    </nav>
  );

  // Basic plan: blurred preview built from demo data, never the real numbers.
  if (!hasFeature(business, "analytics", now)) {
    const model = buildAnalyticsModel(sampleAnalyticsInputs(today, period, now));
    return (
      <>
        <PageHeader title={t("analytics.title")} />
        <LockedFeature title={t("analytics.lockedTitle")} text={t("analytics.lockedText")} />
        <div className="relative">
          <p className="text-muted-foreground mb-2 text-xs">{t("analytics.previewNote")}</p>
          <div aria-hidden inert className="pointer-events-none blur-[3px] select-none">
            <AnalyticsView model={model} interactive={false} />
          </div>
        </div>
      </>
    );
  }

  const { range, dailyFrom } = analyticsQueryRange(today, period);
  const [daily, heatmap, cards, staff, messages] = await Promise.all([
    analyticsDaily(supabase, business.id, dailyFrom, today),
    analyticsHeatmap(supabase, business.id, range.from, today),
    analyticsCardStats(supabase, business.id),
    analyticsStaff(supabase, business.id, range.from, today),
    listMessages(supabase, business.id, 100),
  ]);

  const model = buildAnalyticsModel({
    today,
    period,
    timezone: business.timezone,
    avgCheck: business.avg_check,
    now,
    daily,
    heatmap,
    cards,
    staff,
    broadcasts: messages.filter((m) => m.kind === "broadcast"),
  });

  return (
    <>
      <PageHeader title={t("analytics.title")} actions={periodSwitch} />
      <AnalyticsView model={model} />
    </>
  );
}
