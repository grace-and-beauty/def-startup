import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type { Staff, StaffWithPinHash } from "./types";

/** Never select pin_hash outside the PIN check. Owners can't read it anyway (column grant). */
export const STAFF_SAFE_COLUMNS = "id, business_id, name, is_active, created_at" as const;

export async function listStaff(db: Db, businessId: string): Promise<Staff[]> {
  return (
    unwrap(
      "listStaff",
      await db
        .from("staff")
        .select(STAFF_SAFE_COLUMNS)
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
    ) ?? []
  );
}

export async function getStaffById(db: Db, businessId: string, staffId: string): Promise<Staff | null> {
  return unwrap(
    "getStaffById",
    await db
      .from("staff")
      .select(STAFF_SAFE_COLUMNS)
      .eq("business_id", businessId)
      .eq("id", staffId)
      .maybeSingle(),
  );
}

export async function countActiveStaff(db: Db, businessId: string): Promise<number> {
  const { count, error } = await db
    .from("staff")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_active", true);
  unwrap("countActiveStaff", { data: null, error });
  return count ?? 0;
}

/** Service role only: candidates for the PIN comparison at /scan/[slug]. */
export async function listActiveStaffWithPinHashes(
  admin: Db,
  businessId: string,
): Promise<StaffWithPinHash[]> {
  return (
    unwrap(
      "listActiveStaffWithPinHashes",
      await admin
        .from("staff")
        .select("id, business_id, name, pin_hash, is_active, created_at")
        .eq("business_id", businessId)
        .eq("is_active", true),
    ) ?? []
  );
}

/** pinHash must already be a bcrypt hash (src/lib/security/pin.ts). */
export async function createStaff(
  db: Db,
  input: { businessId: string; name: string; pinHash: string },
): Promise<Staff> {
  return unwrapRequired(
    "createStaff",
    await db
      .from("staff")
      .insert({ business_id: input.businessId, name: input.name, pin_hash: input.pinHash })
      .select(STAFF_SAFE_COLUMNS)
      .single(),
  );
}

export async function updateStaff(
  db: Db,
  businessId: string,
  staffId: string,
  patch: { name?: string; isActive?: boolean; pinHash?: string },
): Promise<Staff> {
  return unwrapRequired(
    "updateStaff",
    await db
      .from("staff")
      .update({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.isActive !== undefined && { is_active: patch.isActive }),
        ...(patch.pinHash !== undefined && { pin_hash: patch.pinHash }),
      })
      .eq("business_id", businessId)
      .eq("id", staffId)
      .select(STAFF_SAFE_COLUMNS)
      .single(),
  );
}

// ---------------------------------------------------------------------------
// staff_login_attempts (service role only)
// ---------------------------------------------------------------------------

export async function recordStaffLoginAttempt(
  admin: Db,
  input: { businessId: string; ipHash: string; success: boolean },
): Promise<void> {
  unwrap(
    "recordStaffLoginAttempt",
    await admin.from("staff_login_attempts").insert({
      business_id: input.businessId,
      ip_hash: input.ipHash,
      success: input.success,
    }),
  );
}

export async function countFailedStaffLoginAttempts(
  admin: Db,
  input: { businessId: string; ipHash: string; since: Date },
): Promise<number> {
  const { count, error } = await admin
    .from("staff_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("business_id", input.businessId)
    .eq("ip_hash", input.ipHash)
    .eq("success", false)
    .gte("created_at", input.since.toISOString());
  unwrap("countFailedStaffLoginAttempts", { data: null, error });
  return count ?? 0;
}
