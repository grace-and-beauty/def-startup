import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type { Program, TablesInsert, TablesUpdate } from "./types";

/** Fields safe for public pages. */
export const PROGRAM_PUBLIC_COLUMNS =
  "id, business_id, type, stamps_required, reward_text, terms_text" as const;

export type ProgramPublic = Pick<
  Program,
  "id" | "business_id" | "type" | "stamps_required" | "reward_text" | "terms_text"
>;

export type ProgramUpdate = Pick<
  TablesUpdate<"programs">,
  | "stamps_required"
  | "reward_text"
  | "terms_text"
  | "reminders_enabled"
  | "reminder_days"
  | "reminder_text"
  | "google_class_id"
>;

export async function getProgramByBusinessId(db: Db, businessId: string): Promise<Program | null> {
  return unwrap(
    "getProgramByBusinessId",
    await db.from("programs").select("*").eq("business_id", businessId).maybeSingle(),
  );
}

export async function getPublicProgramByBusinessId(
  db: Db,
  businessId: string,
): Promise<ProgramPublic | null> {
  return unwrap(
    "getPublicProgramByBusinessId",
    await db
      .from("programs")
      .select(PROGRAM_PUBLIC_COLUMNS)
      .eq("business_id", businessId)
      .maybeSingle(),
  );
}

export async function createProgram(
  db: Db,
  input: Omit<TablesInsert<"programs">, "id" | "created_at" | "updated_at">,
): Promise<Program> {
  return unwrapRequired(
    "createProgram",
    await db.from("programs").insert(input).select("*").single(),
  );
}

export async function updateProgram(
  db: Db,
  businessId: string,
  programId: string,
  patch: ProgramUpdate,
): Promise<Program> {
  return unwrapRequired(
    "updateProgram",
    await db
      .from("programs")
      .update(patch)
      .eq("id", programId)
      .eq("business_id", businessId)
      .select("*")
      .single(),
  );
}

/** Service role: remember the Google Wallet class id of the program. */
export async function updateProgramGoogleClass(
  admin: Db,
  businessId: string,
  programId: string,
  classId: string | null,
): Promise<void> {
  if (!classId) return;
  unwrap(
    "updateProgramGoogleClass",
    await admin
      .from("programs")
      .update({ google_class_id: classId })
      .eq("id", programId)
      .eq("business_id", businessId),
  );
}
