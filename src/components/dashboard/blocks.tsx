import { Lock } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Change } from "@/lib/domain/analytics";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Title row of a dashboard page. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

/** A dashboard section: card with title + optional hint (explains the metric). */
export function Section({
  title,
  hint,
  action,
  children,
  className,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {action}
        </div>
        {hint ? <CardDescription>{hint}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Text of a month-over-month change: "↑ 12% до минулого місяця". */
export function deltaText(delta: Change): string {
  if (delta.deltaPct === null) return delta.current === 0 ? t("overview.deltaFlat") : t("overview.deltaNoPrev");
  if (delta.deltaPct > 0) return t("overview.deltaUp", { pct: delta.deltaPct });
  if (delta.deltaPct < 0) return t("overview.deltaDown", { pct: Math.abs(delta.deltaPct) });
  return t("overview.deltaFlat");
}

/** Number tile with a hint and an optional month-over-month change. */
export function StatCard({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  delta?: Change;
}) {
  const tone =
    delta?.deltaPct === null || delta?.deltaPct === undefined || delta.deltaPct === 0
      ? "text-muted-foreground"
      : delta.deltaPct > 0
        ? "text-success"
        : "text-destructive";
  return (
    <Card className="gap-2 py-4">
      <CardContent className="flex flex-col gap-1 px-4">
        <span className="text-muted-foreground text-sm">{label}</span>
        <span className="font-display text-[1.7rem] leading-tight font-bold tabular-nums">{value}</span>
        {delta ? <span className={cn("text-xs", tone)}>{deltaText(delta)}</span> : null}
        {hint ? <span className="text-muted-foreground text-xs">{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

/** Notice for a feature that needs the Plus plan. */
export function LockedFeature({ title, text }: { title: string; text?: string }) {
  return (
    <div className="bg-muted flex flex-col gap-3 rounded-lg p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex gap-3">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="flex flex-col gap-1">
          <p className="font-medium">{title}</p>
          {text ? <p className="text-muted-foreground text-sm">{text}</p> : null}
        </div>
      </div>
      <Button asChild size="sm" className="shrink-0">
        <Link href="/dashboard/billing">{t("dashboard.upgradeCta")}</Link>
      </Button>
    </div>
  );
}

/** Banner above the dashboard content (trial, cancellation…). */
export function Banner({
  children,
  tone = "neutral",
  action,
}: {
  children: ReactNode;
  tone?: "neutral" | "warning";
  action?: ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between print:hidden",
        tone === "warning" ? "border-destructive/40 bg-destructive/5" : "bg-muted",
      )}
    >
      <p>{children}</p>
      {action}
    </div>
  );
}
