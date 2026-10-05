import { NextResponse, type NextRequest } from "next/server";

import { getOwnerBusiness, getOwnerSession } from "@/lib/auth/owner";
import { toCsv } from "@/lib/csv";
import { fetchAllPages, listActivity, logOwnerExport, type CustomerWithCard } from "@/lib/data";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { logEvent } from "@/lib/log";

/** Upper bound of one export; far above any plan's customer limit. */
const MAX_ROWS = 20_000;

function at(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("uk-UA", { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(iso));
}

/**
 * The owner's own data as CSV: ?kind=customers (default) or ?kind=events.
 * Read with the owner's session (RLS), every export leaves an audit record.
 * Card tokens are never exported — they are the customers' credentials.
 */
export async function GET(request: NextRequest) {
  const [session, owned] = await Promise.all([getOwnerSession(), getOwnerBusiness()]);
  if (!session || !owned) return NextResponse.redirect(new URL("/login", request.url));
  const { business } = owned;
  const db = session.supabase;
  const tz = business.timezone;
  const kind = request.nextUrl.searchParams.get("kind") === "events" ? "events" : "customers";

  try {
    let csv: string;
    let rows: number;
    if (kind === "customers") {
      const customers = await fetchAllPages<CustomerWithCard>(
        "exportCustomers",
        (from, to) =>
          db
            .from("customers")
            .select(
              "*, cards(id, qr_token, stamps_count, rewards_available, rewards_redeemed, total_visits, last_visit_at, wallet_type)",
            )
            .eq("business_id", business.id)
            .order("created_at", { ascending: true })
            .range(from, to) as unknown as PromiseLike<{ data: CustomerWithCard[] | null; error: null }>,
        MAX_ROWS,
      );
      rows = customers.length;
      csv = toCsv(
        [
          t("clients.csv.name"),
          t("clients.csv.phone"),
          t("clients.csv.consentAt"),
          t("clients.csv.stamps"),
          t("clients.csv.rewardsAvailable"),
          t("clients.csv.rewardsRedeemed"),
          t("clients.csv.visits"),
          t("clients.csv.lastVisit"),
          t("clients.csv.createdAt"),
          t("clients.csv.anonymizedAt"),
        ],
        customers.map((customer) => {
          const card = customer.cards[0];
          return [
            customer.name,
            customer.phone,
            at(customer.marketing_consent_at, tz),
            card?.stamps_count ?? 0,
            card?.rewards_available ?? 0,
            card?.rewards_redeemed ?? 0,
            card?.total_visits ?? 0,
            at(card?.last_visit_at, tz),
            formatDate(customer.created_at, tz),
            at(customer.anonymized_at, tz),
          ];
        }),
      );
    } else {
      const events = await listActivity(db, business.id, MAX_ROWS);
      rows = events.length;
      csv = toCsv(
        [t("clients.csv.eventAt"), t("clients.csv.eventType"), t("clients.csv.customer"), t("clients.csv.staff")],
        events.map((event) => [
          at(event.createdAt, tz),
          event.type === "stamp" ? t("clients.csv.stamp") : t("clients.csv.reward"),
          event.customerName ?? t("clients.noName"),
          event.staffName ?? "",
        ]),
      );
    }

    await logOwnerExport(db, business.id, kind === "customers" ? "export_customers" : "export_events", rows);
    logEvent("info", "data_exported", { businessId: business.id, kind, rows });

    const date = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${kind}-${business.slug}-${date}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    logEvent("error", "action_failed", { action: "export", businessId: business.id, kind, error });
    return new NextResponse(t("common.error"), { status: 500 });
  }
}
