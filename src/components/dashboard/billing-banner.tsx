import Link from "next/link";

import { Banner } from "@/components/dashboard/blocks";
import { Button } from "@/components/ui/button";
import { CANCELED_GRACE_DAYS } from "@/config/plans";
import type { Business } from "@/lib/data";
import { daysLeft } from "@/lib/domain/dates";
import { effectivePlan, isTrialActive } from "@/lib/domain/plans";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";

/** Trial / cancellation / non-payment notice at the top of every dashboard page. */
export function BillingBanner({ business, now }: { business: Business; now: Date }) {
  const plan = effectivePlan(business, now);
  const action = (
    <Button asChild size="sm" variant="outline" className="shrink-0">
      <Link href="/dashboard/billing">{t("dashboard.toBilling")}</Link>
    </Button>
  );

  if (plan === "inactive") {
    return (
      <Banner tone="warning" action={action}>
        {t("dashboard.inactiveBanner")}
      </Banner>
    );
  }
  if (business.billing_status === "canceled") {
    const canceledAt = business.canceled_at ? new Date(business.canceled_at) : now;
    const until = new Date(canceledAt.getTime() + CANCELED_GRACE_DAYS * 86_400_000);
    return (
      <Banner tone="warning" action={action}>
        {t("dashboard.canceledBanner", { date: formatDate(until, business.timezone) })}
      </Banner>
    );
  }
  if (business.billing_status === "past_due") {
    return (
      <Banner tone="warning" action={action}>
        {t("dashboard.pastDueBanner")}
      </Banner>
    );
  }
  if (isTrialActive(business, now)) {
    const ends = new Date(business.trial_ends_at);
    return (
      <Banner action={action}>
        {t("dashboard.trialBanner", {
          date: formatDate(ends, business.timezone),
          days: daysLeft(ends, now),
        })}
      </Banner>
    );
  }
  return null;
}
