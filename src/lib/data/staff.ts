import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type { BeginStaffLoginResult, Staff, StaffWithPinHash } from "./types";

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

/**
 * Reserves a PIN attempt before the comparison (RPC begin_staff_login, see
 * supabase/migrations/*_security_guards.sql). The attempt is stored as a
 * failure; call markStaffLoginSucceeded() after a matching PIN.
 */
export async function beginStaffLogin(
  admin: Db,
  input: {
    businessId: string;
    ipHash: string;
    windowMinutes: number;
    maxIpFailures: number;
    maxBusinessFailures: number;
  },
): Promise<BeginStaffLoginResult> {
  const rows = unwrapRequired(
    "beginStaffLogin",
    await admin.rpc("begin_staff_login", {
      p_business_id: input.businessId,
      p_ip_hash: input.ipHash,
      p_window_minutes: input.windowMinutes,
      p_max_ip_failures: input.maxIpFailures,
      p_max_business_failures: input.maxBusinessFailures,
    }),
  );
  const [row] = rows;
  if (!row) throw new Error("beginStaffLogin: empty result");
  return row;
}

export async function markStaffLoginSucceeded(
  admin: Db,
  input: { businessId: string; attemptId: number },
): Promise<void> {
  unwrap(
    "markStaffLoginSucceeded",
    await admin
      .from("staff_login_attempts")
      .update({ success: true })
      .eq("business_id", input.businessId)
      .eq("id", input.attemptId),
  );
}
