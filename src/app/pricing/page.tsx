import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PublicShell } from "@/components/public-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PLAN_IDS, PLANS, type PlanConfig } from "@/config/plans";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: t("pricing.title") };

function planLines(plan: PlanConfig): string[] {
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

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("pricing.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("pricing.subtitle")}</p>
      </section>

      <ul className="grid gap-4 md:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const plan = PLANS[id];
          return (
            <li key={id}>
              <Card className={cn("h-full", plan.highlighted && "border-foreground border-2")}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-xl">{t(plan.nameKey)}</CardTitle>
                    {plan.highlighted ? <Badge>{t("pricing.recommended")}</Badge> : null}
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
                {plan.availableInMvp ? (
                  <CardFooter>
                    <Button
                      asChild
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      <Link href="/login">{t("pricing.cta")}</Link>
                    </Button>
                  </CardFooter>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>

      <p className="text-muted-foreground text-sm">{t("pricing.paymentNote")}</p>
    </PublicShell>
  );
}
