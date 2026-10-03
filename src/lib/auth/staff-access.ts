import "server-only";

import { listActiveStaffWithPinHashes } from "@/lib/data";
import { pinVersion } from "@/lib/security/pin";
import type { Db } from "@/lib/supabase/types";

import type { StaffSession } from "./staff-session";

/**
 * True when the staff member's PIN changed after this scanner session signed
 * in. The scanner page and every scanner action treat such a session as
 * signed out. (Inactive staff are rejected separately by usableStaff.)
 */
export async function isStaffPinChanged(admin: Db, session: StaffSession): Promise<boolean> {
  const active = await listActiveStaffWithPinHashes(admin, session.businessId);
  const current = active.find((member) => member.id === session.staffId);
  return current !== undefined && pinVersion(current.pin_hash) !== session.pinVersion;
}
