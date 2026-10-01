import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type { Business, TablesInsert, TablesUpdate } from "./types";

/** Fields safe to show on public pages (/c/[slug], /card/[token], wallet). */
export const BUSINESS_PUBLIC_COLUMNS =
  "id, name, slug, niche_slug, logo_url, bg_color, fg_color, label_color, timezone, plan, trial_ends_at, plan_renews_at, billing_status, canceled_at" as const;

export type BusinessPublic = Pick<
  Business,
  | "id"
  | "name"
  | "slug"
  | "niche_slug"
  | "logo_url"
  | "bg_color"
  | "fg_color"
  | "label_color"
  | "timezone"
  | "plan"
  | "trial_ends_at"
  | "plan_renews_at"
  | "billing_status"
  | "canceled_at"
>;

/** Columns an owner may change (billing columns are guarded by a DB trigger). */
export type BusinessOwnerUpdate = Pick<
  TablesUpdate<"businesses">,
  | "name"
  | "slug"
  | "niche_slug"
  | "logo_url"
  | "bg_color"
  | "fg_color"
  | "label_color"
  | "timezone"
  | "avg_check"
  | "enabled_modules"
  | "onboarding_done"
>;

/** Billing columns — service role only. */
export type BusinessBillingUpdate = Pick<
  TablesUpdate<"businesses">,
  "plan" | "trial_ends_at" | "plan_renews_at" | "billing_status" | "canceled_at"
>;

export async function getBusinessById(db: Db, id: string): Promise<Business | null> {
  return unwrap(
    "getBusinessById",
    await db.from("businesses").select("*").eq("id", id).maybeSingle(),
  );
}

/** The (single, in MVP) business of an owner. */
export async function getBusinessByOwner(db: Db, ownerId: string): Promise<Business | null> {
  return unwrap(
    "getBusinessByOwner",
    await db
      .from("businesses")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  );
}

export async function getPublicBusinessBySlug(db: Db, slug: string): Promise<BusinessPublic | null> {
  return unwrap(
    "getPublicBusinessBySlug",
    await db.from("businesses").select(BUSINESS_PUBLIC_COLUMNS).eq("slug", slug).maybeSingle(),
  );
}

export async function getPublicBusinessById(db: Db, id: string): Promise<BusinessPublic | null> {
  return unwrap(
    "getPublicBusinessById",
    await db.from("businesses").select(BUSINESS_PUBLIC_COLUMNS).eq("id", id).maybeSingle(),
  );
}

/** Needs the service-role client to see other owners' slugs. */
export async function isSlugTaken(db: Db, slug: string): Promise<boolean> {
  const { count, error } = await db
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("slug", slug);
  unwrap("isSlugTaken", { data: null, error });
  return (count ?? 0) > 0;
}

export async function createBusiness(
  db: Db,
  input: Omit<TablesInsert<"businesses">, keyof BusinessBillingUpdate | "id" | "created_at" | "updated_at">,
): Promise<Business> {
  return unwrapRequired(
    "createBusiness",
    await db.from("businesses").insert(input).select("*").single(),
  );
}

export async function updateBusiness(
  db: Db,
  id: string,
  patch: BusinessOwnerUpdate,
): Promise<Business> {
  return unwrapRequired(
    "updateBusiness",
    await db.from("businesses").update(patch).eq("id", id).select("*").single(),
  );
}

/** Service role only (manual plan changes in the MVP). */
export async function updateBusinessBilling(
  admin: Db,
  id: string,
  patch: BusinessBillingUpdate,
): Promise<Business> {
  return unwrapRequired(
    "updateBusinessBilling",
    await admin.from("businesses").update(patch).eq("id", id).select("*").single(),
  );
}

/** For cron: businesses with reminders turned on in their program. */
export async function listBusinessesWithRemindersEnabled(admin: Db): Promise<Business[]> {
  const rows = unwrap(
    "listBusinessesWithRemindersEnabled",
    await admin
      .from("businesses")
      .select("*, programs!inner(reminders_enabled)")
      .eq("programs.reminders_enabled", true),
  );
  return (rows ?? []).map(({ programs: _programs, ...business }) => business);
}
