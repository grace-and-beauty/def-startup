import type { AdminBusiness, AdminBusinessStats, AdminWeek } from "@/lib/domain/admin-overview";
import type { Db } from "@/lib/supabase/types";

import { unwrapRequired } from "./errors";

/**
 * Service admin dashboard reads (service role only — callers check the admin
 * first, src/lib/auth/admin.ts). Read-only.
 */

export async function listAllBusinesses(admin: Db): Promise<AdminBusiness[]> {
  return unwrapRequired(
    "listAllBusinesses",
    await admin
      .from("businesses")
      .select(
        "id, name, slug, niche_slug, city, contact_phone, plan, billing_status, trial_ends_at, plan_renews_at, canceled_at, onboarding_done, created_at",
      )
      .order("created_at", { ascending: true }),
  );
}

/**
 * Own categories typed with «Інше» (businesses.niche_label), by business id.
 * A separate read so /admin still opens where migration 20261014000100 is
 * not applied yet: the caller treats a failure as "no labels".
 */
export async function listNicheLabels(admin: Db): Promise<Map<string, string>> {
  const rows = unwrapRequired(
    "listNicheLabels",
    await admin.from("businesses").select("id, niche_label").not("niche_label", "is", null),
  );
  return new Map(rows.flatMap((r) => (r.niche_label ? [[r.id, r.niche_label] as const] : [])));
}

export async function getAdminBusinessStats(
  admin: Db,
  range: { from: Date; to: Date; prevFrom: Date; prevTo: Date },
): Promise<AdminBusinessStats[]> {
  return unwrapRequired(
    "getAdminBusinessStats",
    await admin.rpc("admin_business_stats", {
      p_from: range.from.toISOString(),
      p_to: range.to.toISOString(),
      p_prev_from: range.prevFrom.toISOString(),
      p_prev_to: range.prevTo.toISOString(),
    }),
  );
}

export async function getAdminWeeklyGrowth(admin: Db, range: { from: Date; to: Date }): Promise<AdminWeek[]> {
  return unwrapRequired(
    "getAdminWeeklyGrowth",
    await admin.rpc("admin_weekly_growth", { p_from: range.from.toISOString(), p_to: range.to.toISOString() }),
  );
}
