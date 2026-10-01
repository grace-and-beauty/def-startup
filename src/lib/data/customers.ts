import type { Db } from "@/lib/supabase/types";

import { sanitizeSearch, unwrap, unwrapRequired } from "./errors";
import type { Card, Customer } from "./types";

export type CustomerWithCard = Customer & {
  cards: Pick<
    Card,
    | "id"
    | "qr_token"
    | "stamps_count"
    | "rewards_available"
    | "rewards_redeemed"
    | "total_visits"
    | "last_visit_at"
    | "wallet_type"
  >[];
};

export async function createCustomer(
  db: Db,
  input: { businessId: string; name?: string | null; phone?: string | null },
): Promise<Customer> {
  return unwrapRequired(
    "createCustomer",
    await db
      .from("customers")
      .insert({ business_id: input.businessId, name: input.name ?? null, phone: input.phone ?? null })
      .select("*")
      .single(),
  );
}

export async function countCustomers(db: Db, businessId: string): Promise<number> {
  const { count, error } = await db
    .from("customers")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  unwrap("countCustomers", { data: null, error });
  return count ?? 0;
}

export async function listCustomersWithCards(
  db: Db,
  businessId: string,
  options: { search?: string; limit?: number; offset?: number } = {},
): Promise<{ rows: CustomerWithCard[]; total: number }> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  let query = db
    .from("customers")
    .select(
      "*, cards(id, qr_token, stamps_count, rewards_available, rewards_redeemed, total_visits, last_visit_at, wallet_type)",
      { count: "exact" },
    )
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const search = options.search ? sanitizeSearch(options.search) : "";
  if (search) {
    query = query.or(`name.ilike.*${search}*,phone.ilike.*${search}*`);
  }

  const { data, error, count } = await query;
  const rows = unwrap("listCustomersWithCards", { data, error }) ?? [];
  return { rows: rows as CustomerWithCard[], total: count ?? rows.length };
}
