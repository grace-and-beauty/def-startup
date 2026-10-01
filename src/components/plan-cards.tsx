import { Check } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PLAN_IDS, PLANS, type PlanConfig, type PlanId } from "@/config/plans";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Human-readable feature lines of a plan (pricing page, billing page). */
export function planLines(plan: PlanConfig): string[] {
  const { limits } = plan;
  const lines = [t("pricing.baseFeatures")];
  lines.push(
    Number.isFinite(limits.customers)
      ? t("pricing.customers", { count: limits.customers.toLocaleString("uk-UA") })
      : t("pricing.customersUnlimited"),
  );
  lines.push(
    Number.isFinite(limits.broadcastsPerMonth)
      ? t("pricing.broadcasts", { count: limits.broadcastsPerMonth })
      : t("pricing.broadcastsUnlimited"),
  );
  lines.push(
    plan.features.includes("staff_pins")
      ? t("pricing.staff", { count: limits.staff })
      : t("pricing.staffSingle"),
  );
  if (!plan.features.includes("analytics")) lines.push(t("pricing.baseAnalytics"));
  for (const feature of plan.features) {
    if (feature === "staff_pins" || feature === "unlimited_broadcasts") continue;
    lines.push(t(`pricing.features.${feature}`));
  }
  return lines;
}

interface PlanCardsProps {
  /** Highlights this plan with a "your plan" badge (billing page). */
  currentPlan?: PlanId | null;
  /** Footer of each sellable plan (CTA button). */
  renderFooter?: (plan: PlanConfig) => ReactNode;
}

export function PlanCards({ currentPlan, renderFooter }: PlanCardsProps) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {PLAN_IDS.map((id) => {
        const plan = PLANS[id];
        const isCurrent = currentPlan === id;
        const emphasized = currentPlan ? isCurrent : plan.highlighted;
        return (
          <li key={id}>
            <Card className={cn("h-full", emphasized && "border-foreground border-2")}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-xl">{t(plan.nameKey)}</CardTitle>
                  {isCurrent ? <Badge>{t("billing.currentBadge")}</Badge> : null}
                  {!currentPlan && plan.highlighted ? (
                    <Badge>{t("pricing.recommended")}</Badge>
                  ) : null}
                  {!plan.availableInMvp ? (
                    <Badge variant="secondary">{t("pricing.soon")}</Badge>
                  ) : null}
                </div>
                <CardDescription className="text-foreground text-2xl font-semibold">
                  {t("plans.perMonth", { price: plan.priceUah })}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="flex flex-col gap-2 text-sm">
                  {planLines(plan).map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              {plan.availableInMvp && renderFooter ? (
                <CardFooter>{renderFooter(plan)}</CardFooter>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
