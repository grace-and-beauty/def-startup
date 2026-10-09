"use client";

import { Mail, MessageCircle, Phone, Send } from "lucide-react";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { contactLinks, type AdminPlanTag, type AdminRow } from "@/lib/domain/admin-overview";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Filter = "all" | "trial" | "paid" | "sleeping";

const FILTERS: { id: Filter; label: Parameters<typeof t>[0] }[] = [
  { id: "all", label: "admin.filterAll" },
  { id: "trial", label: "admin.filterTrial" },
  { id: "paid", label: "admin.filterPaid" },
  { id: "sleeping", label: "admin.filterSleeping" },
];

export function planLabel(plan: AdminPlanTag): string {
  if (plan === "trial" || plan === "trial_over" || plan === "canceled") return t(`admin.planTag.${plan}`);
  return t(`plans.${plan}.name`);
}

function lastStamp(row: AdminRow): string {
  if (!row.lastStampAt) return t("admin.neverStamped");
  if (row.idleDays === 0) return t("admin.today");
  if (row.idleDays === 1) return t("admin.yesterday");
  return t("admin.daysAgo", { days: row.idleDays });
}

/** All businesses with search, filters and buttons to reach the owner. */
export function BusinessesTable({ rows, nicheNames }: { rows: AdminRow[]; nicheNames: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter === "trial" && row.plan !== "trial") return false;
      if (filter === "paid" && row.monthlyUah === 0) return false;
      if (filter === "sleeping" && !row.sleeping) return false;
      if (!q) return true;
      return [row.name, row.city ?? "", row.email ?? "", row.slug].some((v) => v.toLowerCase().includes(q));
    });
  }, [rows, query, filter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("admin.search")}
          aria-label={t("admin.search")}
          className="h-10 min-w-0 flex-[1_1_14rem] rounded-full"
        />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm transition-colors",
              filter === f.id ? "bg-ink text-ink-foreground border-ink" : "bg-card hover:bg-muted",
            )}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t("admin.empty")}</p>
      ) : (
        <ul className="flex flex-col">
          <li
            aria-hidden
            className="text-muted-foreground hidden grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_7rem_5rem_6rem_8rem_minmax(0,1.6fr)] gap-3 border-b pb-2 text-xs lg:grid"
          >
            <span>{t("admin.colBusiness")}</span>
            <span>{t("admin.colNiche")}</span>
            <span>{t("admin.colPlan")}</span>
            <span className="text-right">{t("admin.colCustomers")}</span>
            <span className="text-right">{t("admin.colStamps")}</span>
            <span>{t("admin.colLast")}</span>
            <span>{t("admin.colContact")}</span>
          </li>
          {shown.map((row) => (
            <BusinessRow key={row.id} row={row} niche={nicheNames[row.nicheSlug] ?? row.nicheSlug} />
          ))}
        </ul>
      )}
    </div>
  );
}

function BusinessRow({ row, niche }: { row: AdminRow; niche: string }) {
  const links = contactLinks(row.phone, row.email);
  const paid = row.monthlyUah > 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b py-3 text-sm lg:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_7rem_5rem_6rem_8rem_minmax(0,1.6fr)]">
      <div className="min-w-0">
        <p className="truncate font-medium">{row.name}</p>
        <p className="text-muted-foreground truncate text-xs">
          {[row.city, row.email].filter(Boolean).join(" · ") || row.slug}
        </p>
      </div>
      <span className="text-muted-foreground hidden truncate lg:block">{niche}</span>
      <span>
        <span
          className={cn(
            "inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap",
            paid ? "bg-ink text-ink-foreground" : "bg-muted",
          )}
        >
          {planLabel(row.plan)}
        </span>
      </span>
      <span className="text-muted-foreground lg:text-foreground tabular-nums lg:text-right">
        <span className="lg:hidden">{t("admin.colCustomers")}: </span>
        {row.customers}
      </span>
      <span className="text-muted-foreground lg:text-foreground text-right tabular-nums">
        <span className="lg:hidden">{t("admin.colStamps")}: </span>
        {row.stampsThisPeriod}
      </span>
      <span className="col-span-2 lg:col-span-1">
        {row.sleeping ? (
          <span className="bg-destructive/10 text-destructive inline-block rounded-full px-2.5 py-0.5 text-xs whitespace-nowrap">
            {t("admin.sleeping")} · {lastStamp(row)}
          </span>
        ) : (
          <span className="text-muted-foreground">{lastStamp(row)}</span>
        )}
      </span>
      <div className="col-span-2 flex flex-wrap gap-1.5 lg:col-span-1">
        {links.call ? (
          <ContactLink href={links.call} label={t("admin.call")} icon={<Phone className="size-3.5" aria-hidden />} />
        ) : (
          <span className="text-muted-foreground text-xs">{t("admin.noPhone")}</span>
        )}
        {links.viber ? (
          <ContactLink href={links.viber} label={t("admin.viber")} icon={<MessageCircle className="size-3.5" aria-hidden />} />
        ) : null}
        {links.telegram ? (
          <ContactLink href={links.telegram} label={t("admin.telegram")} icon={<Send className="size-3.5" aria-hidden />} external />
        ) : null}
        {links.email ? (
          <ContactLink href={links.email} label={t("admin.email")} icon={<Mail className="size-3.5" aria-hidden />} />
        ) : null}
      </div>
    </li>
  );
}

function ContactLink({
  href,
  label,
  icon,
  external = false,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="bg-card hover:bg-muted inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
    >
      {icon}
      {label}
    </a>
  );
}
