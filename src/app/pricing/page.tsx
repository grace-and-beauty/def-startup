import type { Metadata } from "next";
import Link from "next/link";

import { PlanCards } from "@/components/plan-cards";
import { PublicShell } from "@/components/public-shell";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("pricing.title") };

export default function PricingPage() {
  return (
    <PublicShell>
      <section className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("pricing.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("pricing.subtitle")}</p>
      </section>

      <PlanCards
        renderFooter={(plan) => (
          <Button asChild className="w-full" variant={plan.highlighted ? "default" : "outline"}>
            <Link href="/login">{t("pricing.cta")}</Link>
          </Button>
        )}
      />

      <p className="text-muted-foreground text-sm">{t("pricing.paymentNote")}</p>
    </PublicShell>
  );
}
