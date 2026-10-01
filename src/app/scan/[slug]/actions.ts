"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clearStaffSession, isStaffSessionConfigured, readStaffSession, setStaffSession } from "@/lib/auth/staff-cookie";
import {
  applyStamp,
  countFailedStaffLoginAttempts,
  getCardByToken,
  getPublicProgramByBusinessId,
  getStaffById,
  listActiveStaffWithPinHashes,
  recordStaffLoginAttempt,
  redeemReward,
} from "@/lib/data";
import { ipHashSecret, MissingEnvError, stampCooldownMinutes } from "@/lib/env";
import { isValidSlug } from "@/lib/domain/slug";
import { loadPublicBusiness } from "@/lib/public/loaders";
import { findStaffByPin, isValidPin } from "@/lib/security/pin";
import {
  clientIpFromHeaders,
  hashIp,
  isStaffLoginLocked,
  STAFF_LOGIN_MAX_FAILURES,
  staffLoginWindowStart,
} from "@/lib/security/rate-limit";
import { extractQrToken } from "@/lib/security/tokens";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Db } from "@/lib/supabase/types";

import type { LookupResult, PinState, ScanActionResult, ScanCardCounters, ScanFailure } from "./types";

// ---------------------------------------------------------------------------
// PIN login / logout
// ---------------------------------------------------------------------------

function ipHashSecretOrNull(): string | null {
  try {
    return ipHashSecret();
  } catch (error) {
    if (error instanceof MissingEnvError) return null;
    throw error;
  }
}

/** PIN → signed staff_session cookie (12 h). Locks out after 5 failures / 15 min per IP + business. */
export async function staffLogin(slug: string, _prev: PinState, formData: FormData): Promise<PinState> {
  const pin = String(formData.get("pin") ?? "").trim();
  if (!isValidPin(pin)) return { status: "error", reason: "pinFormat" };

  const loaded = await loadPublicBusiness(String(slug));
  if (loaded.status === "unavailable") return { status: "error", reason: "notConfigured" };
  if (loaded.status === "not_found") return { status: "error", reason: "notFound" };
  const { business } = loaded.data;

  const ipSecret = ipHashSecretOrNull();
  const admin = tryCreateSupabaseAdminClient();
  if (!ipSecret || !admin || !isStaffSessionConfigured()) {
    return { status: "error", reason: "notConfigured" };
  }

  let staffId: string;
  try {
    const ipHash = hashIp(clientIpFromHeaders(await headers()), ipSecret);
    const failures = await countFailedStaffLoginAttempts(admin, {
      businessId: business.id,
      ipHash,
      since: staffLoginWindowStart(new Date()),
    });
    if (isStaffLoginLocked(failures)) return { status: "error", reason: "locked" };

    const candidates = await listActiveStaffWithPinHashes(admin, business.id);
    const match = await findStaffByPin(pin, candidates);
    await recordStaffLoginAttempt(admin, { businessId: business.id, ipHash, success: match !== null });

    if (!match) {
      return {
        status: "error",
        reason: failures + 1 >= STAFF_LOGIN_MAX_FAILURES ? "locked" : "pinInvalid",
      };
    }
    staffId = match.id;
  } catch (error) {
    console.error("staffLogin failed", error instanceof Error ? error.message : error);
    return { status: "error", reason: "unknown" };
  }

  await setStaffSession({ businessId: business.id, staffId });
  redirect(`/scan/${business.slug}`);
}

export async function staffLogout(slug: string): Promise<void> {
  await clearStaffSession();
  redirect(isValidSlug(String(slug)) ? `/scan/${slug}` : "/");
}

// ---------------------------------------------------------------------------
// Scanner actions — every call re-checks the session, the staff member and
// that the card belongs to the session's business (architecture §8).
// ---------------------------------------------------------------------------

interface StaffContext {
  admin: Db;
  businessId: string;
  staffId: string;
}

async function requireStaff(): Promise<StaffContext | ScanFailure> {
  const session = await readStaffSession();
  const admin = tryCreateSupabaseAdminClient();
  if (!session || !admin) return "session_expired";
  const staff = await getStaffById(admin, session.businessId, session.staffId);
  if (!staff) return "session_expired";
  if (!staff.is_active) return "staff_inactive";
  return { admin, businessId: session.businessId, staffId: session.staffId };
}

const cardIdSchema = z.uuid();

async function stampsRequired(ctx: StaffContext): Promise<number | null> {
  const program = await getPublicProgramByBusinessId(ctx.admin, ctx.businessId);
  return program?.stamps_required ?? null;
}

export async function lookupCard(input: string): Promise<LookupResult> {
  try {
    const ctx = await requireStaff();
    if (typeof ctx === "string") return { ok: false, reason: ctx };

    const token = extractQrToken(String(input ?? "").slice(0, 512));
    if (!token) return { ok: false, reason: "invalid_code" };

    const card = await getCardByToken(ctx.admin, token, ctx.businessId);
    if (!card) return { ok: false, reason: "not_found" };
    const required = await stampsRequired(ctx);
    if (required === null) return { ok: false, reason: "not_found" };

    return {
      ok: true,
      card: {
        id: card.id,
        customerName: card.customer?.name ?? null,
        stampsCount: card.stamps_count,
        stampsRequired: required,
        rewardsAvailable: card.rewards_available,
        totalVisits: card.total_visits,
      },
    };
  } catch (error) {
    console.error("lookupCard failed", error instanceof Error ? error.message : error);
    return { ok: false, reason: "error" };
  }
}

function toCounters(row: {
  card_id: string;
  stamps_count: number | null;
  stamps_required: number | null;
  rewards_available: number | null;
  total_visits: number | null;
}): ScanCardCounters {
  return {
    id: row.card_id,
    stampsCount: row.stamps_count ?? 0,
    stampsRequired: row.stamps_required ?? 0,
    rewardsAvailable: row.rewards_available ?? 0,
    totalVisits: row.total_visits ?? 0,
  };
}

/** +1 stamp (RPC apply_stamp: row lock, cooldown, overflow → reward). */
export async function addStamp(cardId: string): Promise<ScanActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  if (!id.success) return { ok: false, reason: "not_found" };
  try {
    const ctx = await requireStaff();
    if (typeof ctx === "string") return { ok: false, reason: ctx };

    const result = await applyStamp(ctx.admin, {
      businessId: ctx.businessId,
      cardId: id.data,
      staffId: ctx.staffId,
      cooldownMinutes: stampCooldownMinutes(),
    });
    if (result.status !== "ok") {
      return { ok: false, reason: result.status, retryAfter: result.retry_after };
    }
    // TODO(stage 3): wallet.updateCard() for wallet_type = 'google' (errors must not undo the stamp).
    return {
      ok: true,
      kind: "stamp",
      card: toCounters(result),
      rewardsEarned: result.rewards_earned,
    };
  } catch (error) {
    console.error("addStamp failed", error instanceof Error ? error.message : error);
    return { ok: false, reason: "error" };
  }
}

/** Hand out one available reward (RPC redeem_reward). */
export async function redeemCardReward(cardId: string): Promise<ScanActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  if (!id.success) return { ok: false, reason: "not_found" };
  try {
    const ctx = await requireStaff();
    if (typeof ctx === "string") return { ok: false, reason: ctx };

    const result = await redeemReward(ctx.admin, {
      businessId: ctx.businessId,
      cardId: id.data,
      staffId: ctx.staffId,
    });
    if (result.status !== "ok") return { ok: false, reason: result.status };
    // TODO(stage 3): wallet.updateCard().
    return {
      ok: true,
      kind: "reward",
      card: toCounters(result),
      rewardsEarned: 0,
    };
  } catch (error) {
    console.error("redeemCardReward failed", error instanceof Error ? error.message : error);
    return { ok: false, reason: "error" };
  }
}

