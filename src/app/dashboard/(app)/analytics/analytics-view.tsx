import { Lightbulb } from "lucide-react";
import Link from "next/link";

import { DailyVisitsChart } from "@/components/charts/daily-visits-chart";
import { Heatmap } from "@/components/charts/heatmap";
import { Section, StatCard } from "@/components/dashboard/blocks";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { insightAction, type Insight } from "@/lib/domain/analytics";
import { formatDate, formatNumber } from "@/lib/format";
import { t, type TranslationKey } from "@/lib/i18n";

import type { AnalyticsModel } from "./model";

const DOW_LONG_KEYS: readonly TranslationKey[] = [
  "analytics.dowLong.1",
  "analytics.dowLong.2",
  "analytics.dowLong.3",
  "analytics.dowLong.4",
  "analytics.dowLong.5",
  "analytics.dowLong.6",
  "analytics.dowLong.7",
];

function dowLong(dow: number): string {
  return t(DOW_LONG_KEYS[Math.min(Math.max(dow, 1), 7) - 1]);
}

function insightText(insight: Insight): string {
  switch (insight.kind) {
    case "atRisk":
      return t("analytics.insight.atRisk", { count: insight.count });
    case "growth":
      return t("analytics.insight.growth", { pct: insight.pct });
    case "decline":
      return t("analytics.insight.decline", { pct: insight.pct });
    case "lowRetention":
      return t("analytics.insight.lowRetention", { rate: insight.rate });
    case "peak":
      return t("analytics.insight.peak", { day: dowLong(insight.dow), hour: insight.hour });
    case "noAvgCheck":
      return t("analytics.insight.noAvgCheck");
    case "remindersOff":
      return insight.days === null
        ? t("analytics.insight.remindersOffNoDays")
        : t("analytics.insight.remindersOff", { days: insight.days });
    case "pendingRewards":
      return t("analytics.insight.pendingRewards", { count: insight.count });
    case "broadcastWorked":
      return t("analytics.insight.broadcastWorked", { pct: insight.pct });
    case "noRecentBroadcast":
      return insight.days === null
        ? t("analytics.insight.noBroadcastYet")
        : t("analytics.insight.noRecentBroadcast", { days: insight.days });
  }
}

/** Action button of a hint: target page + label (null = text-only hint). */
function insightLink(insight: Insight): { href: string; label: string } | null {
  switch (insightAction(insight)) {
    case "broadcastAtRisk":
      return {
        href: "/dashboard/messages?target=at_risk",
        label: t("analytics.insightAction.broadcastAtRisk", { count: insight.kind === "atRisk" ? insight.count : 0 }),
      };
    case "broadcast":
      return { href: "/dashboard/messages", label: t("analytics.insightAction.broadcast") };
    case "reminders":
      return { href: "/dashboard/settings#reminders", label: t("analytics.insightAction.reminders") };
    case "avgCheck":
      return { href: "/dashboard/settings#business", label: t("analytics.insightAction.avgCheck") };
    case null:
      return null;
  }
}

const AT_RISK_SHOWN = 8;

/**
 * Analytics screen body. Rendered with real data (Plus) or with demo data,
 * blurred, as a preview on Basic — `interactive=false` then disables links.
 */
export function AnalyticsView({ model, interactive = true }: { model: AnalyticsModel; interactive?: boolean }) {
  const tz = model.timezone;
  const actionLink = (href: string, label: string) =>
    interactive ? (
      <Button asChild size="sm" variant="outline">
        <Link href={href}>{label}</Link>
      </Button>
    ) : (
      <Button size="sm" variant="outline" tabIndex={-1}>
        {label}
      </Button>
    );

  return (
    <div className="flex flex-col gap-6">
      {model.insights.length > 0 ? (
        <Section title={t("analytics.insightsTitle")}>
          <ul className="flex flex-col divide-y">
            {model.insights.map((insight) => {
              const link = insightLink(insight);
              return (
                <li
                  key={insight.kind}
                  className="flex flex-col gap-2 py-2 text-sm first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex gap-2">
                    <Lightbulb className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
                    <span>{insightText(insight)}</span>
                  </span>
                  {link ? <span className="shrink-0 pl-6 sm:pl-0">{actionLink(link.href, link.label)}</span> : null}
                </li>
              );
            })}
          </ul>
        </Section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{t("analytics.comparisonTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label={t("analytics.metrics.stamps")}
            value={formatNumber(model.comparison.stamps.current)}
            delta={model.comparison.stamps}
          />
          <StatCard
            label={t("analytics.metrics.newCards")}
            value={formatNumber(model.comparison.newCards.current)}
            delta={model.comparison.newCards}
          />
          <StatCard
            label={t("analytics.metrics.repeatVisits")}
            value={formatNumber(model.comparison.repeatVisits.current)}
            delta={model.comparison.repeatVisits}
          />
          <StatCard
            label={t("analytics.metrics.rewards")}
            value={formatNumber(model.comparison.rewards.current)}
            delta={model.comparison.rewards}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {t("analytics.comparisonHint", { day: model.comparisonDay })}
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label={t("analytics.retention")}
          value={model.retention.rate === null ? "—" : `${model.retention.rate}%`}
          hint={t("analytics.retentionHint", {
            returned: model.retention.returned,
            visited: model.retention.visited,
          })}
        />
        <StatCard
          label={t("analytics.returned30")}
          value={model.returned30.rate === null ? "—" : `${model.returned30.rate}%`}
          hint={
            model.returned30.rate === null
              ? t("analytics.returned30Empty")
              : t("analytics.returned30Hint", {
                  returned: model.returned30.returned,
                  cohort: model.returned30.cohort,
                })
          }
        />
        <StatCard
          label={t("analytics.interval")}
          value={
            model.medianInterval === null
              ? "—"
              : t("analytics.intervalValue", { days: formatNumber(model.medianInterval) })
          }
          hint={t("analytics.intervalHint")}
        />
        <StatCard
          label={t("analytics.active")}
          value={formatNumber(model.activeCount)}
          hint={t("analytics.activeHint")}
        />
        <StatCard
          label={t("analytics.pendingRewards")}
          value={formatNumber(model.pendingRewards.rewards)}
          hint={t("analytics.pendingRewardsHint", {
            cards: model.pendingRewards.cards,
            rewards: model.pendingRewards.rewards,
          })}
        />
        <StatCard
          label={t("analytics.revenue")}
          value={
            model.revenue === null ? "—" : t("analytics.revenueValue", { amount: formatNumber(model.revenue) })
          }
          hint={
            model.revenue === null || model.avgCheck === null
              ? t("analytics.revenueNoCheck")
              : t("analytics.revenueHint", { avgCheck: formatNumber(model.avgCheck) })
          }
        />
      </div>

      <Section
        title={t("analytics.dailyTitle")}
        hint={t("analytics.dailyHint")}
      >
        {model.periodTotals.stamps === 0 ? (
          <p className="text-muted-foreground text-sm">{t("analytics.noData")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <DailyVisitsChart data={model.daily} />
            <p className="text-muted-foreground text-xs">
              {t("analytics.totalsNewRepeat", {
                new: formatNumber(model.periodTotals.firstVisits),
                repeat: formatNumber(model.periodTotals.repeatVisits),
              })}
            </p>
          </div>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={t("analytics.heatmapTitle")} hint={t("analytics.heatmapHint")}>
          {model.peak ? (
            <Heatmap matrix={model.heatmap} />
          ) : (
            <p className="text-muted-foreground text-sm">{t("analytics.noData")}</p>
          )}
        </Section>

        <Section
          title={t("analytics.atRiskTitle")}
          hint={t("analytics.atRiskHint")}
          action={
            model.atRisk.length > 0
              ? actionLink(
                  "/dashboard/messages?target=at_risk",
                  t("analytics.atRiskAction", { count: model.atRisk.length }),
                )
              : undefined
          }
        >
          {model.atRisk.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("analytics.atRiskEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {model.atRisk.slice(0, AT_RISK_SHOWN).map((card) => (
                <li key={card.card_id} className="flex justify-between gap-2 py-2">
                  <span className="truncate">{card.customer_name ?? t("clients.noName")}</span>
                  <span className="text-muted-foreground shrink-0">
                    {t("analytics.visitsCount", { count: card.visits })} ·{" "}
                    {t("analytics.daysAgo", { days: card.daysSinceVisit })}
                  </span>
                </li>
              ))}
              {model.atRisk.length > AT_RISK_SHOWN ? (
                <li className="text-muted-foreground py-2">
                  {t("analytics.atRiskMore", { count: model.atRisk.length - AT_RISK_SHOWN })}
                </li>
              ) : null}
            </ul>
          )}
        </Section>
      </div>

      <Section title={t("analytics.topTitle")} hint={t("analytics.topHint")}>
        {model.top.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("analytics.noData")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("analytics.colCustomer")}</TableHead>
                <TableHead className="text-right">{t("analytics.colVisits")}</TableHead>
                <TableHead className="hidden text-right sm:table-cell">{t("analytics.colRewards")}</TableHead>
                <TableHead className="text-right">{t("analytics.colLastVisit")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {model.top.map((card) => (
                <TableRow key={card.card_id}>
                  <TableCell className="max-w-40 truncate">{card.customer_name ?? t("clients.noName")}</TableCell>
                  <TableCell className="text-right tabular-nums">{card.visits}</TableCell>
                  <TableCell className="hidden text-right tabular-nums sm:table-cell">
                    {card.rewards_redeemed}
                  </TableCell>
                  <TableCell className="text-right">
                    {card.last_visit_at ? formatDate(card.last_visit_at, tz) : t("clients.none")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title={t("analytics.broadcastsTitle")}
          hint={t("analytics.broadcastsHint", {
            baseline: formatNumber(model.effects[0]?.baseline ?? 0),
          })}
          action={actionLink("/dashboard/messages", t("analytics.newBroadcast"))}
        >
          {model.effects.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("analytics.broadcastsEmpty")}</p>
          ) : (
            <ul className="flex flex-col divide-y text-sm">
              {model.effects.map((effect) => (
                <li key={effect.messageId} className="flex flex-col gap-1 py-2">
                  <span className="line-clamp-2">{effect.text}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(effect.sentAt, tz)} ·{" "}
                    {t("analytics.broadcastVisits", { count: effect.visitsAfter })}
                    {effect.liftPct !== null
                      ? ` · ${
                          effect.liftPct >= 0
                            ? t("analytics.broadcastLiftUp", { pct: effect.liftPct })
                            : t("analytics.broadcastLiftDown", { pct: Math.abs(effect.liftPct) })
                        }`
                      : ""}
                    {effect.partial ? ` (${t("analytics.partial")})` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={t("analytics.staffTitle")} hint={t("analytics.staffHint")}>
          {model.staff.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("analytics.noData")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("analytics.colStaff")}</TableHead>
                  <TableHead className="text-right">{t("analytics.colStamps")}</TableHead>
                  <TableHead className="text-right">{t("analytics.colRewards")}</TableHead>
                  <TableHead className="text-right">{t("analytics.colCards")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {model.staff.map((row) => (
                  <TableRow key={row.staff_id ?? "none"}>
                    <TableCell className="max-w-36 truncate">
                      {row.staff_name ?? t("analytics.staffUnknown")}
                      {row.is_active === false ? (
                        <span className="text-muted-foreground"> ({t("analytics.staffInactive")})</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.stamps}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.rewards}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.unique_cards}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>

      {model.avgCheck === null ? (
        <div>{actionLink("/dashboard/settings#business", t("analytics.setAvgCheck"))}</div>
      ) : null}
    </div>
  );
}
