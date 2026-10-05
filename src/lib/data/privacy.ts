import type { Db } from "@/lib/supabase/types";

import { unwrap } from "./errors";
import type { StampEventType } from "./types";

/**
 * Owner (RLS + an ownership check inside the function): removes a customer's
 * personal data, keeps the visit journal, replaces the card link, writes an
 * audit record. false = not found or already anonymized.
 */
export async function anonymizeCustomer(db: Db, customerId: string): Promise<boolean> {
  return unwrap("anonymizeCustomer", await db.rpc("anonymize_customer", { p_customer_id: customerId })) ?? false;
}

/** Owner: audit record for an export of personal data (CSV). */
export async function logOwnerExport(
  db: Db,
  businessId: string,
  action: "export_customers" | "export_events",
  rows: number,
): Promise<void> {
  unwrap(
    "logOwnerExport",
    await db.rpc("log_owner_action", { p_business_id: businessId, p_action: action, p_details: { rows } }),
  );
}

export interface ActivityRow {
  id: number;
  type: StampEventType;
  createdAt: string;
  cardId: string;
  customerName: string | null;
  staffName: string | null;
}

const MAX_EVENTS = 20_000;
/** PostgREST returns at most 1 000 rows per request by default (db-max-rows). */
const PAGE = 1000;

/** Reads a query page by page (range) until `max` rows or the end. */
async function fetchAll<T>(
  operation: string,
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: Parameters<typeof unwrap>[1]["error"] }>,
  max: number,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += PAGE) {
    const to = Math.min(from + PAGE, max) - 1;
    const chunk = unwrap(operation, await page(from, to)) ?? [];
    rows.push(...chunk);
    if (chunk.length < to - from + 1) break;
  }
  return rows;
}

/**
 * Stamp journal with customer and staff names, newest first (owner's
 * activity log and the events CSV). Names are joined in code: three plain
 * queries under RLS instead of embedded selects.
 */
export async function listActivity(db: Db, businessId: string, limit: number): Promise<ActivityRow[]> {
  const events = await fetchAll(
    "listActivity",
    (from, to) =>
      db
        .from("stamp_events")
        .select("id, type, created_at, card_id, staff_id")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    Math.min(Math.max(limit, 1), MAX_EVENTS),
  );
  if (events.length === 0) return [];

  const [cards, staff] = await Promise.all([
    fetchAll(
      "listActivity",
      (from, to) =>
        db.from("cards").select("id, customer:customers(name)").eq("business_id", businessId).order("id").range(from, to),
      MAX_EVENTS,
    ),
    db.from("staff").select("id, name").eq("business_id", businessId),
  ]);
  const cardNames = new Map(
    cards.map((card) => {
      const customer = card.customer as { name: string | null } | { name: string | null }[] | null;
      const name = Array.isArray(customer) ? (customer[0]?.name ?? null) : (customer?.name ?? null);
      return [card.id, name] as const;
    }),
  );
  const staffNames = new Map((unwrap("listActivity", staff) ?? []).map((member) => [member.id, member.name] as const));

  return events.map((event) => ({
    id: event.id,
    type: event.type,
    createdAt: event.created_at,
    cardId: event.card_id,
    customerName: cardNames.get(event.card_id) ?? null,
    staffName: event.staff_id ? (staffNames.get(event.staff_id) ?? null) : null,
  }));
}

export { fetchAll as fetchAllPages };
