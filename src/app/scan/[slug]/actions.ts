"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isStaffPinChanged } from "@/lib/auth/staff-access";
import { clearStaffSession, isStaffSessionConfigured, readStaffSession, setStaffSession } from "@/lib/auth/staff-cookie";
import {
  applyStamp as applyStampRpc,
  beginStaffLogin,
  getCardById,
  getCardByToken,
  getPublicBusinessById,
  getPublicProgramByBusinessId,
  listActiveStaffWithPinHashes,
  listStaff,
  markStaffLoginSucceeded,
  redeemReward as redeemRewardRpc,
  type BusinessPublic,
  type CardWithCustomer,
  type ProgramPublic,
} from "@/lib/data";
import { pinSchema, slugSchema } from "@/lib/domain/business-input";
import { canStamp, usableStaff } from "@/lib/domain/plans";
import { applyStamp, cardStateFromRow, cooldownEndsAt, redeemReward } from "@/lib/domain/stamps";
import { ipHashSecret, MissingEnvError, stampCooldownMinutes } from "@/lib/env";
import { loadPublicBusiness } from "@/lib/public/loaders";
import { findStaffByPin, pinVersion } from "@/lib/security/pin";
import {
  clientIpFromHeaders,
  hashIp,
  STAFF_LOGIN_MAX_BUSINESS_FAILURES,
  STAFF_LOGIN_MAX_FAILURES,
  STAFF_LOGIN_WINDOW_MINUTES,
} from "@/lib/security/rate-limit";
import { extractQrToken } from "@/lib/security/tokens";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Db } from "@/lib/supabase/types";
import { scheduleWalletTask } from "@/lib/wallet/background";

import type { LookupResult, PinState, ScanActionResult, ScanCardCounters, ScanFailure } from "./types";
import { logEvent } from "@/lib/log";

// ---------------------------------------------------------------------------
// Input schemas (bound arguments come from the client too — validate them)
// ---------------------------------------------------------------------------

const loginSchema = z.object({ slug: slugSchema, pin: pinSchema });
const logoutSchema = slugSchema;
const codeSchema = z.string().trim().min(1).max(512);
const cardIdSchema = z.uuid();

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

/**
 * PIN → signed staff_session cookie (12 h). The attempt is reserved atomically
 * before the bcrypt comparison (RPC begin_staff_login), so parallel guesses
 * count too: ≥ 5 failures per IP + business within 15 min lock that IP for the
 * rest of the window; ≥ 30 failures for the business from any IP lock new
 * logins of the business.
 */
export async function staffLogin(slug: string, _prev: PinState, formData: FormData): Promise<PinState> {
  const parsed = loginSchema.safeParse({ slug, pin: formData.get("pin") ?? "" });
  if (!parsed.success) {
    const slugInvalid = parsed.error.issues.some((issue) => issue.path[0] === "slug");
    return { status: "error", reason: slugInvalid ? "notFound" : "pinFormat" };
  }
  const { pin } = parsed.data;

  const loaded = await loadPublicBusiness(parsed.data.slug);
  if (loaded.status === "unavailable") return { status: "error", reason: "notConfigured" };
  if (loaded.status === "not_found") return { status: "error", reason: "notFound" };
  const { business } = loaded.data;

  const ipSecret = ipHashSecretOrNull();
  const admin = tryCreateSupabaseAdminClient();
  if (!ipSecret || !admin || !isStaffSessionConfigured()) {
    return { status: "error", reason: "notConfigured" };
  }

  let staffId: string;
  let staffPinVersion: string;
  try {
    const ipHash = hashIp(clientIpFromHeaders(await headers()), ipSecret);
    const attempt = await beginStaffLogin(admin, {
      businessId: business.id,
      ipHash,
      windowMinutes: STAFF_LOGIN_WINDOW_MINUTES,
      maxIpFailures: STAFF_LOGIN_MAX_FAILURES,
      maxBusinessFailures: STAFF_LOGIN_MAX_BUSINESS_FAILURES,
    });
    if (attempt.status !== "ok" || attempt.attempt_id === null) {
      logEvent("warn", "staff_login_locked", { businessId: business.id, scope: attempt.status });
      return { status: "error", reason: "locked" };
    }

    // Only PINs the current plan allows (Basic: just the default «Загальний»).
    const candidates = usableStaff(await listActiveStaffWithPinHashes(admin, business.id), business, new Date());
    const match = await findStaffByPin(pin, candidates);
    if (!match) {
      logEvent("warn", "staff_login_failed", { businessId: business.id, failures: attempt.failures + 1 });
      return {
        status: "error",
        reason: attempt.failures + 1 >= STAFF_LOGIN_MAX_FAILURES ? "locked" : "pinInvalid",
      };
    }
    await markStaffLoginSucceeded(admin, { businessId: business.id, attemptId: attempt.attempt_id });
    staffId = match.id;
    staffPinVersion = pinVersion(match.pin_hash);
    logEvent("info", "staff_login_succeeded", { businessId: business.id, staffId });
  } catch (error) {
    logEvent("error", "action_failed", { action: "staffLogin", error });
    return { status: "error", reason: "unknown" };
  }

  await setStaffSession({ businessId: business.id, staffId, pinVersion: staffPinVersion });
  redirect(`/scan/${business.slug}`);
}

export async function staffLogout(slug: string): Promise<void> {
  await clearStaffSession();
  const parsed = logoutSchema.safeParse(slug);
  redirect(parsed.success ? `/scan/${parsed.data}` : "/");
}

// ---------------------------------------------------------------------------
// Scanner actions — every call re-verifies the signed session, that the staff
// member still exists, is active and still has the PIN the session was opened
// with, and filters every query by the session's business_id, so a card of
// another business is never found (architecture §8).
// ---------------------------------------------------------------------------

interface StaffContext {
  admin: Db;
  business: BusinessPublic;
  program: ProgramPublic;
  staffId: string;
}

async function requireStaff(): Promise<StaffContext | ScanFailure> {
  const session = await readStaffSession();
  const admin = tryCreateSupabaseAdminClient();
  if (!session || !admin) return "session_expired";
  const [staffList, pinChanged, business, program] = await Promise.all([
    listStaff(admin, session.businessId),
    isStaffPinChanged(admin, session),
    getPublicBusinessById(admin, session.businessId),
    getPublicProgramByBusinessId(admin, session.businessId),
  ]);
  const staff = staffList.find((member) => member.id === session.staffId);
  if (!staff || !business || !program || pinChanged) return "session_expired";
  // Deactivated, or beyond the plan's PIN limit after a downgrade.
  if (!usableStaff(staffList, business, new Date()).some((member) => member.id === staff.id)) {
    return "staff_inactive";
  }
  return { admin, business, program, staffId: staff.id };
}

export async function lookupCard(input: string): Promise<LookupResult> {
  const code = codeSchema.safeParse(input);
  if (!code.success) return { ok: false, reason: "invalid_code" };
  try {
    const ctx = await requireStaff();
    if (typeof ctx === "string") return { ok: false, reason: ctx };

    const token = extractQrToken(code.data);
    if (!token) return { ok: false, reason: "invalid_code" };

    const card = await getCardByToken(ctx.admin, token, ctx.business.id);
    if (!card) return { ok: false, reason: "not_found" };

    const nextStampAt = cooldownEndsAt(cardStateFromRow(card), stampCooldownMinutes(), new Date());
    return {
      ok: true,
      card: {
        id: card.id,
        customerName: card.customer?.name ?? null,
        stampsCount: card.stamps_count,
        stampsRequired: ctx.program.stamps_required,
        rewardsAvailable: card.rewards_available,
        totalVisits: card.total_visits,
        nextStampAt: nextStampAt?.toISOString() ?? null,
      },
    };
  } catch (error) {
    logEvent("error", "action_failed", { action: "lookupCard", error });
    return { ok: false, reason: "error" };
  }
}

function toCounters(
  row: {
    card_id: string;
    stamps_count: number | null;
    stamps_required: number | null;
    rewards_available: number | null;
    total_visits: number | null;
    last_visit_at: string | null;
  },
  now: Date,
): ScanCardCounters {
  const next = cooldownEndsAt(
    { lastVisitAt: row.last_visit_at ? new Date(row.last_visit_at) : null },
    stampCooldownMinutes(),
    now,
  );
  return {
    id: row.card_id,
    stampsCount: row.stamps_count ?? 0,
    stampsRequired: row.stamps_required ?? 0,
    rewardsAvailable: row.rewards_available ?? 0,
    totalVisits: row.total_visits ?? 0,
    nextStampAt: next?.toISOString() ?? null,
  };
}

/**
 * Google Wallet pass: refresh the counters after the response is sent.
 * Errors are logged and never undo the stamp (architecture §5.2).
 */
function syncWalletCard(
  ctx: StaffContext,
  card: CardWithCustomer,
  counters: { stamps_count: number | null; rewards_available: number | null },
): void {
  if (card.wallet_type !== "google") return;
  const updated = {
    ...card,
    stamps_count: counters.stamps_count ?? card.stamps_count,
    rewards_available: counters.rewards_available ?? card.rewards_available,
  };
  scheduleWalletTask("updateCard", (wallet) => wallet.updateCard(updated, ctx.program, ctx.business));
}

/**
 * +1 stamp: domain pre-check (cooldown) without taking a lock, then the RPC
 * apply_stamp (row lock, re-checks cooldown and staff, overflow → reward).
 */
export async function addStamp(cardId: string): Promise<ScanActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  if (!id.success) return { ok: false, reason: "not_found" };
  try {
    const ctx = await requireStaff();
    if (typeof ctx === "string") return { ok: false, reason: ctx };
    const now = new Date();
    const reject = (reason: ScanFailure, retryAfter?: string | null): ScanActionResult => {
      logEvent("info", "stamp_rejected", { businessId: ctx.business.id, cardId: id.data, staffId: ctx.staffId, reason });
      return { ok: false, reason, retryAfter };
    };
    if (!canStamp(ctx.business, now)) return reject("inactive");

    const card = await getCardById(ctx.admin, ctx.business.id, id.data);
    if (!card) return reject("not_found");

    const cooldownMinutes = stampCooldownMinutes();
    const preview = applyStamp(
      cardStateFromRow(card),
      { stampsRequired: ctx.program.stamps_required },
      now,
      cooldownMinutes,
    );
    if (!preview.ok) return reject("cooldown", preview.retryAfter.toISOString());

    const result = await applyStampRpc(ctx.admin, {
      businessId: ctx.business.id,
      cardId: card.id,
      staffId: ctx.staffId,
      cooldownMinutes,
    });
    if (result.status !== "ok") return reject(result.status, result.retry_after);
    logEvent("info", "stamp_added", {
      businessId: ctx.business.id,
      cardId: card.id,
      staffId: ctx.staffId,
      rewardsEarned: result.rewards_earned,
    });
    syncWalletCard(ctx, card, result);
    return {
      ok: true,
      kind: "stamp",
      card: toCounters(result, now),
      rewardsEarned: result.rewards_earned,
    };
  } catch (error) {
    logEvent("error", "action_failed", { action: "addStamp", error });
    return { ok: false, reason: "error" };
  }
}

/** Hand out one available reward (domain pre-check, then RPC redeem_reward). */
export async function redeemCardReward(cardId: string): Promise<ScanActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  if (!id.success) return { ok: false, reason: "not_found" };
  try {
    const ctx = await requireStaff();
    if (typeof ctx === "string") return { ok: false, reason: ctx };
    const reject = (reason: ScanFailure): ScanActionResult => {
      logEvent("info", "reward_rejected", { businessId: ctx.business.id, cardId: id.data, staffId: ctx.staffId, reason });
      return { ok: false, reason };
    };
    if (!canStamp(ctx.business, new Date())) return reject("inactive");

    const card = await getCardById(ctx.admin, ctx.business.id, id.data);
    if (!card) return reject("not_found");
    if (!redeemReward(cardStateFromRow(card)).ok) return reject("no_reward");

    const result = await redeemRewardRpc(ctx.admin, {
      businessId: ctx.business.id,
      cardId: card.id,
      staffId: ctx.staffId,
    });
    if (result.status !== "ok") return reject(result.status);
    logEvent("info", "reward_redeemed", { businessId: ctx.business.id, cardId: card.id, staffId: ctx.staffId });
    syncWalletCard(ctx, card, result);
    return { ok: true, kind: "reward", card: toCounters(result, new Date()), rewardsEarned: 0 };
  } catch (error) {
    logEvent("error", "action_failed", { action: "redeemCardReward", error });
    return { ok: false, reason: "error" };
  }
}
