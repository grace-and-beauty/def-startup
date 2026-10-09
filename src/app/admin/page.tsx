import { deltaText } from "@/components/dashboard/blocks";
import { PLAN_IDS, PLANS } from "@/config/plans";
import { getNiche } from "@/config/niches";
import { requireAdmin } from "@/lib/auth/admin";
import { getAdminBusinessStats, getAdminWeeklyGrowth, listAllBusinesses } from "@/lib/data";
import { buildAdminOverview, type AdminOverview } from "@/lib/domain/admin-overview";
import { addDays, monthToDateComparison, toLocalDate, zonedMidnight } from "@/lib/domain/dates";
import { formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { logEvent } from "@/lib/log";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

import { BusinessesTable, planLabel } from "./businesses-table";
import { GrowthChart } from "./growth-chart";

/** Months and weeks are counted in Kyiv time, like the businesses' own dashboards. */
const TIME_ZONE = "Europe/Kyiv";
const WEEKS = 13;

export default async function AdminPage() {
  const { user } = await requireAdmin();
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return <p className="text-destructive">{t("admin.unavailable")}</p>;

  const now = new Date();
  const { current, previous } = monthToDateComparison(toLocalDate(now, TIME_ZONE));
  const periodStart = zonedMidnight(current.from, TIME_ZONE);
  const previousPeriodStart = zonedMidnight(previous.from, TIME_ZONE);
  const previousPeriodEnd = zonedMidnight(addDays(previous.to, 1), TIME_ZONE);

  const [businesses, stats, weeks] = await Promise.all([
    listAllBusinesses(admin),
    getAdminBusinessStats(admin, {
      from: periodStart,
      to: now,
      prevFrom: previousPeriodStart,
      prevTo: previousPeriodEnd,
    }),
    getAdminWeeklyGrowth(admin, { from: new Date(now.getTime() - (WEEKS - 1) * 7 * 86_400_000), to: now }),
  ]);
  logEvent("info", "admin_viewed", { userId: user.id });

  const overview = buildAdminOverview({
    businesses,
    stats,
    weeks,
    periodStart,
    now,
  });
  const nicheNames = Object.fromEntries(overview.niches.map((n) => [n.slug, getNiche(n.slug)?.name ?? n.slug]));

  return (
    <div className="flex flex-col gap-4">
      <section className="bg-ink text-ink-foreground rounded-[1.75rem] p-6 sm:p-8">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{t("admin.heroTitle")}</h1>
        <p className="text-ink-muted mt-1 mb-6 text-sm">{t("admin.comparison")}</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            label={t("admin.businesses")}
            value={formatNumber(overview.businesses.current)}
            note={t("admin.businessesNew", { count: overview.businesses.current - overview.businesses.previous })}
          />
          <Kpi
            label={t("admin.revenue")}
            value={`${formatNumber(overview.revenueUah.current)} ₴`}
            note={t("admin.revenuePaid", { count: overview.paidCount })}
          />
          <Kpi
            label={t("admin.customers")}
            value={formatNumber(overview.customers)}
            note={t("admin.customersNew", { count: overview.newCustomers.current })}
          />
          <Kpi label={t("admin.stamps")} value={formatNumber(overview.stamps.current)} note={deltaText(overview.stamps)} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={t("admin.nichesTitle")} hint={t("admin.nichesHint")}>
          <Niches overview={overview} names={nicheNames} />
        </Panel>
        <Panel title={t("admin.plansTitle")} hint={t("admin.plansHint")}>
          <Plans overview={overview} now={now} />
        </Panel>
      </div>

      <Panel title={t("admin.growthTitle")} hint={t("admin.growthHint")}>
        <div className="text-muted-foreground mb-2 flex gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="bg-foreground size-2.5 rounded-sm" aria-hidden />
            {t("admin.legendCards")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="bg-chart-4 size-2.5 rounded-sm" aria-hidden />
            {t("admin.legendBusinesses")}
          </span>
        </div>
        <GrowthChart weeks={overview.weeks} />
      </Panel>

      <Panel title={t("admin.tableTitle")} hint={t("admin.tableHint")}>
        {overview.rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("admin.noBusinesses")}</p>
        ) : (
          <BusinessesTable rows={overview.rows} nicheNames={nicheNames} />
        )}
      </Panel>
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white/[0.06] p-4">
      <span className="text-ink-muted text-xs sm:text-sm">{label}</span>
      <span className="font-display text-2xl leading-tight font-bold tabular-nums sm:text-[2rem]">{value}</span>
      <span className="text-ink-muted text-xs">{note}</span>
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="bg-card flex flex-col rounded-[1.5rem] border p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <p className="text-muted-foreground mt-1 mb-4 text-sm">{hint}</p>
      {children}
    </section>
  );
}

function Niches({ overview, names }: { overview: AdminOverview; names: Record<string, string> }) {
  const max = Math.max(1, ...overview.niches.map((n) => n.count));
  return (
    <ul className="flex flex-col gap-2">
      {overview.niches.map((n) => (
        <li key={n.slug} className="grid grid-cols-[8.5rem_minmax(0,1fr)_2rem] items-center gap-3 text-sm">
          <span className="truncate">{names[n.slug]}</span>
          <span className="bg-muted h-2.5 overflow-hidden rounded-full">
            <span className="bg-foreground block h-full rounded-full" style={{ width: `${(n.count / max) * 100}%` }} />
          </span>
          <span className="text-right font-medium tabular-nums">{n.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Plans({ overview, now }: { overview: AdminOverview; now: Date }) {
  const tiles = (["trial", ...PLAN_IDS] as const).map((plan) => ({
    plan,
    ...overview.plans[plan],
    price: plan === "trial" ? null : PLANS[plan].priceUah,
  }));
  const unpaid = overview.plans.trial_over.count + overview.plans.canceled.count;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.plan} className="bg-muted rounded-xl px-3 py-2.5">
            <p className="font-display text-2xl font-bold tabular-nums">{tile.count}</p>
            <p className="text-muted-foreground text-xs">
              {planLabel(tile.plan)}
              {tile.price ? ` · ${t("admin.perMonthShort", { price: tile.price })}` : ""}
            </p>
            <p className="text-xs">{t("admin.perMonthShort", { price: formatNumber(tile.revenueUah) })}</p>
          </div>
        ))}
      </div>
      {unpaid > 0 ? (
        <p className="text-muted-foreground text-xs">
          {planLabel("trial_over")}: {overview.plans.trial_over.count} · {planLabel("canceled")}:{" "}
          {overview.plans.canceled.count}
        </p>
      ) : null}
      <div>
        <p className="mb-1 text-sm font-medium">{t("admin.trialsEndingTitle")}</p>
        {overview.trialsEnding.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("admin.trialsEndingNone")}</p>
        ) : (
          <ul className="flex flex-col">
            {overview.trialsEnding.map((row) => {
              const days = Math.max(0, Math.ceil((new Date(row.trialEndsAt!).getTime() - now.getTime()) / 86_400_000));
              return (
                <li key={row.id} className="flex justify-between gap-3 border-t py-2 text-sm">
                  <span className="truncate">
                    {row.name}
                    {row.city ? ` · ${row.city}` : ""}
                  </span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {days === 0 ? t("admin.trialEndsToday") : t("admin.trialEndsIn", { days })}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
