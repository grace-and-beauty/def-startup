"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ownerContextForAction, type OwnerContext } from "@/lib/auth/owner";
import { countActiveStaff, createStaff, getStaffById, listActiveStaffWithPinHashes, updateStaff } from "@/lib/data";
import { formString, newPinSchema, staffNameSchema } from "@/lib/domain/business-input";
import { getLimit, hasFeature } from "@/lib/domain/plans";
import { findStaffByPin, hashPin } from "@/lib/security/pin";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

import type { StaffActionState } from "./types";

type Failure = Extract<StaffActionState, { status: "error" }>;
const fail = (reason: Failure["reason"], limit?: number): StaffActionState => ({ status: "error", reason, limit });
const ok = (): StaffActionState => ({ status: "ok", nonce: Date.now() });

const staffIdSchema = z.uuid();
const activeSchema = z.boolean();

/**
 * Two active staff members with the same PIN would make the scanner log in
 * as whichever matches first, so PINs must be unique among active staff.
 * Needs the service role (owners can't read pin_hash); skipped when absent.
 */
async function isPinTaken(ctx: OwnerContext, pin: string, exceptStaffId?: string): Promise<boolean> {
  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return false;
  const candidates = (await listActiveStaffWithPinHashes(admin, ctx.business.id)).filter(
    (s) => s.id !== exceptStaffId,
  );
  return (await findStaffByPin(pin, candidates)) !== null;
}

async function canAddActive(ctx: OwnerContext, now: Date): Promise<StaffActionState | null> {
  const limit = getLimit(ctx.business, "staff", now);
  const active = await countActiveStaff(ctx.supabase, ctx.business.id);
  return active >= limit ? fail("limitReached", limit) : null;
}

export async function addStaff(_prev: StaffActionState, formData: FormData): Promise<StaffActionState> {
  const ctx = await ownerContextForAction();
  if (!ctx) return fail("sessionExpired");
  const now = new Date();
  if (!hasFeature(ctx.business, "staff_pins", now)) return fail("locked");

  const name = staffNameSchema.safeParse(formString(formData, "name"));
  if (!name.success) return fail("nameInvalid");
  const pin = newPinSchema.safeParse(formString(formData, "pin"));
  if (!pin.success) return fail("pinInvalid");

  try {
    const limited = await canAddActive(ctx, now);
    if (limited) return limited;
    if (await isPinTaken(ctx, pin.data)) return fail("pinTaken");
    await createStaff(ctx.supabase, {
      businessId: ctx.business.id,
      name: name.data,
      pinHash: await hashPin(pin.data),
    });
  } catch (error) {
    console.error("addStaff failed", error instanceof Error ? error.message : error);
    return fail("unknown");
  }
  revalidatePath("/dashboard/staff");
  return ok();
}

export async function setStaffActive(
  staffId: string,
  active: boolean,
  _prev: StaffActionState,
): Promise<StaffActionState> {
  const ctx = await ownerContextForAction();
  if (!ctx) return fail("sessionExpired");
  const id = staffIdSchema.safeParse(staffId);
  if (!id.success) return fail("notFound");
  const activeParsed = activeSchema.safeParse(active);
  if (!activeParsed.success) return fail("unknown");
  active = activeParsed.data;

  try {
    const staff = await getStaffById(ctx.supabase, ctx.business.id, id.data);
    if (!staff) return fail("notFound");
    if (staff.is_active === active) return ok();

    if (active) {
      const limited = await canAddActive(ctx, new Date());
      if (limited) return limited;
    } else if ((await countActiveStaff(ctx.supabase, ctx.business.id)) <= 1) {
      // The scanner needs at least one PIN that works.
      return fail("lastActive");
    }
    await updateStaff(ctx.supabase, ctx.business.id, id.data, { isActive: active });
  } catch (error) {
    console.error("setStaffActive failed", error instanceof Error ? error.message : error);
    return fail("unknown");
  }
  revalidatePath("/dashboard/staff");
  return ok();
}

export async function changeStaffPin(
  staffId: string,
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const ctx = await ownerContextForAction();
  if (!ctx) return fail("sessionExpired");
  const id = staffIdSchema.safeParse(staffId);
  if (!id.success) return fail("notFound");
  const pin = newPinSchema.safeParse(formString(formData, "pin"));
  if (!pin.success) return fail("pinInvalid");

  try {
    const staff = await getStaffById(ctx.supabase, ctx.business.id, id.data);
    if (!staff) return fail("notFound");
    if (await isPinTaken(ctx, pin.data, id.data)) return fail("pinTaken");
    await updateStaff(ctx.supabase, ctx.business.id, id.data, { pinHash: await hashPin(pin.data) });
  } catch (error) {
    console.error("changeStaffPin failed", error instanceof Error ? error.message : error);
    return fail("unknown");
  }
  revalidatePath("/dashboard/staff");
  return ok();
}
