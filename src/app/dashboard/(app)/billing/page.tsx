import { Mail, Send } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader, Section } from "@/components/dashboard/blocks";
import { PlanCards } from "@/components/plan-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { CANCELED_GRACE_DAYS, PAST_DUE_GRACE_DAYS, PLANS } from "@/config/plans";
import { requireOwnerContext } from "@/lib/auth/owner";
import { countActiveStaff, countCustomers, countMessagesSince } from "@/lib/data";
import { daysLeft } from "@/lib/domain/dates";
import { effectivePlan, getLimits, isTrialActive } from "@/lib/domain/plans";
import { formatDate, formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { monthStart } from "../messages/recipients";

export const metadata: Metadata = { title: t("billing.title") };

const DAY_MS = 86_400_000;

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number }) {
  const finite = Number.isFinite(limit);
  const pct = finite && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-2 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">
          {finite
            ? t("billing.usageValue", { used: formatNumber(used), limit: formatNumber(limit) })
            : t("billing.usageUnlimited", { used: formatNumber(used) })}
        </span>
      </div>
      {finite ? (
        <div className="bg-muted h-2 overflow-hidden rounded-full" aria-hidden>
          <div
            className={cn("h-full rounded-full", pct >= 90 ? "bg-destructive" : "bg-foreground")}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </li>
  );
}

export default async function BillingPage() {
  const { supabase, business } = await requireOwnerContext();
  const now = new Date();
  const tz = business.timezone;
  const plan = effectivePlan(business, now);
  const limits = getLimits(business, now);

  const [customers, broadcasts, staff] = await Promise.all([
    countCustomers(supabase, business.id),
    countMessagesSince(supabase, business.id, "broadcast", monthStart(now, tz)),
    countActiveStaff(supabase, business.id),
  ]);

  const trialActive = isTrialActive(business, now);
  const trialEnds = new Date(business.trial_ends_at);
  const notes: string[] = [];
  if (trialActive) {
    notes.push(t("billing.trialUntil", { date: formatDate(trialEnds, tz), days: daysLeft(trialEnds, now) }));
    notes.push(t("billing.afterTrial"));
  } else if (business.plan === "trial") {
    notes.push(t("billing.trialEnded", { date: formatDate(trialEnds, tz) }));
  }
  if (business.plan !== "trial" && business.plan_renews_at && business.billing_status === "active") {
    notes.push(t("billing.renewsAt", { date: formatDate(business.plan_renews_at, tz) }));
  }
  if (business.billing_status === "past_due" && business.plan_renews_at) {
    notes.push(
      t("billing.pastDueNote", { days: PAST_DUE_GRACE_DAYS, date: formatDate(business.plan_renews_at, tz) }),
    );
  }
  if (business.billing_status === "canceled") {
    const canceledAt = business.canceled_at ? new Date(business.canceled_at) : now;
    notes.push(
      t("billing.canceledNote", {
        date: formatDate(new Date(canceledAt.getTime() + CANCELED_GRACE_DAYS * DAY_MS), tz),
      }),
    );
  }
  if (plan === "inactive") notes.push(t("billing.inactiveNote"));

  const mailto = `mailto:${brand.supportEmail}?subject=${encodeURIComponent(
    t("billing.mailSubject", { business: business.name }),
  )}`;

  return (
    <>
      <PageHeader title={t("billing.title")} />

      <Section title={t("billing.current")}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold">
              {plan === "inactive" ? t("plans.inactive") : t(PLANS[plan].nameKey)}
            </span>
            {trialActive ? <Badge variant="secondary">{t("plans.trial")}</Badge> : null}
            <Badge variant={business.billing_status === "active" ? "outline" : "destructive"}>
              {t("billing.statusLabel")}: {t(`billing.status.${business.billing_status}`)}
            </Badge>
          </div>
          {plan !== "inactive" ? (
            <p className="text-muted-foreground text-sm">{t("plans.perMonth", { price: PLANS[plan].priceUah })}</p>
          ) : null}
          {notes.map((note) => (
            <p key={note} className="text-sm">
              {note}
            </p>
          ))}
        </div>
      </Section>

      <Section title={t("billing.usageTitle")}>
        <ul className="flex flex-col gap-4">
          <UsageRow label={t("billing.usageCustomers")} used={customers} limit={limits.customers} />
          <UsageRow label={t("billing.usageBroadcasts")} used={broadcasts} limit={limits.broadcastsPerMonth} />
          <UsageRow label={t("billing.usageStaff")} used={staff} limit={limits.staff} />
        </ul>
      </Section>

      <Section title={t("billing.contactTitle")} hint={t("billing.contactText")}>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <a href={mailto}>
              <Mail aria-hidden />
              {t("billing.contactEmail", { email: brand.supportEmail })}
            </a>
          </Button>
          {brand.supportTelegram ? (
            <Button asChild variant="outline">
              <a href={brand.supportTelegram} target="_blank" rel="noreferrer">
                <Send aria-hidden />
                {t("billing.contactTelegram")}
              </a>
            </Button>
          ) : null}
        </div>
      </Section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t("billing.compareTitle")}</h2>
        <PlanCards currentPlan={plan === "inactive" ? null : plan} />
      </section>
    </>
  );
}
