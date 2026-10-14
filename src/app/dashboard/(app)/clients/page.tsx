import { Download, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/dashboard/blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireOwnerContext } from "@/lib/auth/owner";
import { countCustomers, listCustomersWithCards, type CustomerWithCard } from "@/lib/data";
import { getLimit } from "@/lib/domain/plans";
import { formatDate, formatNumber } from "@/lib/format";
import { t } from "@/lib/i18n";

import { AnonymizeButton } from "./anonymize-button";

export const metadata: Metadata = { title: t("clients.title") };

const PAGE_SIZE = 50;

function cardOf(customer: CustomerWithCard) {
  // MVP: one program → one card per customer.
  return customer.cards[0] ?? null;
}

function ConsentLabel({ customer }: { customer: CustomerWithCard }) {
  if (customer.anonymized_at) return <span>{t("clients.anonymized")}</span>;
  return <span>{customer.marketing_consent_at ? t("clients.consentYes") : t("clients.consentNo")}</span>;
}

function pageHref(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/dashboard/clients?${query}` : "/dashboard/clients";
}

export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const { supabase, business, program } = await requireOwnerContext();
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 64) : "";
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  const [{ rows, total }, totalCustomers] = await Promise.all([
    listCustomersWithCards(supabase, business.id, {
      search: q,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    countCustomers(supabase, business.id),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const limit = getLimit(business, "customers", new Date());
  const tz = business.timezone;

  return (
    <>
      <PageHeader
        title={t("clients.title")}
        description={
          Number.isFinite(limit)
            ? t("clients.limit", { count: formatNumber(totalCustomers), limit: formatNumber(limit) })
            : t("clients.total", { count: formatNumber(totalCustomers) })
        }
        actions={
          <>
            {/* Plain links: a file download, not a client-side navigation. */}
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard/clients/export?kind=customers" data-no-transition>
                <Download aria-hidden />
                {t("clients.exportCustomers")}
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href="/dashboard/clients/export?kind=events" data-no-transition>
                <Download aria-hidden />
                {t("clients.exportEvents")}
              </a>
            </Button>
          </>
        }
      />

      <form role="search" action="/dashboard/clients" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          {t("clients.search")}
        </label>
        <Input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          maxLength={64}
          placeholder={t("clients.search")}
          className="h-10"
        />
        <Button type="submit" className="h-10">
          <Search aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("clients.searchSubmit")}</span>
        </Button>
        {q ? (
          <Button asChild variant="ghost" className="h-10">
            <Link href="/dashboard/clients">{t("clients.reset")}</Link>
          </Button>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <p className="bg-muted rounded-lg p-4 text-sm">
          {q ? t("clients.notFound", { q }) : t("clients.empty")}
        </p>
      ) : (
        <>
          {/* Mobile: one card per customer. */}
          <ul className="flex flex-col divide-y rounded-lg border md:hidden">
            {rows.map((customer) => {
              const card = cardOf(customer);
              return (
                <li key={customer.id} className="flex flex-col gap-1 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-medium">{customer.name ?? t("clients.noName")}</span>
                    <span className="text-sm tabular-nums">
                      {t("card.stampsOf", {
                        count: Math.min(card?.stamps_count ?? 0, program.stamps_required),
                        total: program.stamps_required,
                      })}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap justify-between gap-x-3 text-xs">
                    <span>{customer.phone ?? t("clients.none")}</span>
                    <span>
                      {t("analytics.visitsCount", { count: card?.total_visits ?? 0 })} ·{" "}
                      {card?.last_visit_at ? formatDate(card.last_visit_at, tz) : t("clients.none")}
                    </span>
                  </div>
                  {card && card.rewards_available > 0 ? (
                    <span className="text-success text-xs">
                      {t("clients.rewards", { count: card.rewards_available })}
                    </span>
                  ) : null}
                  <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                    <ConsentLabel customer={customer} />
                    {customer.anonymized_at ? null : <AnonymizeButton customerId={customer.id} />}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table. */}
          <div className="hidden rounded-lg border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("clients.colName")}</TableHead>
                  <TableHead>{t("clients.colPhone")}</TableHead>
                  <TableHead className="text-right">{t("clients.colStamps")}</TableHead>
                  <TableHead className="text-right">{t("clients.colVisits")}</TableHead>
                  <TableHead className="text-right">{t("clients.colLastVisit")}</TableHead>
                  <TableHead>{t("clients.colConsent")}</TableHead>
                  <TableHead>
                    <span className="sr-only">{t("clients.anonymize")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((customer) => {
                  const card = cardOf(customer);
                  return (
                    <TableRow key={customer.id}>
                      <TableCell className="max-w-56 truncate">
                        {customer.name ?? <span className="text-muted-foreground">{t("clients.noName")}</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{customer.phone ?? t("clients.none")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {t("card.stampsOf", {
                          count: Math.min(card?.stamps_count ?? 0, program.stamps_required),
                          total: program.stamps_required,
                        })}
                        {card && card.rewards_available > 0 ? (
                          <span className="text-success ml-2 text-xs">+{card.rewards_available}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{card?.total_visits ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {card?.last_visit_at ? formatDate(card.last_visit_at, tz) : t("clients.none")}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <ConsentLabel customer={customer} />
                      </TableCell>
                      <TableCell className="text-right">
                        {customer.anonymized_at ? null : <AnonymizeButton customerId={customer.id} />}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {pages > 1 ? (
            <nav className="flex items-center justify-between gap-2" aria-label={t("clients.page", { page, pages })}>
              {page > 1 ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(q, page - 1)}>{t("clients.prev")}</Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground text-sm">{t("clients.page", { page, pages })}</span>
              {page < pages ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={pageHref(q, page + 1)}>{t("clients.next")}</Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
