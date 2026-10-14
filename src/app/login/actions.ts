"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { safeNextPath } from "@/lib/auth/redirect";
import { onboardingPathForDraft } from "@/lib/domain/card-draft";
import { hitLoginRateLimit } from "@/lib/data";
import { ipHashSecret, isAdminEmail, isSupabaseConfigured, MissingEnvError, siteUrl } from "@/lib/env";
import { logEvent } from "@/lib/log";
import {
  clientIpFromHeaders,
  hashEmail,
  hashIp,
  LOGIN_CODE_EMAIL_LIMIT,
  LOGIN_CODE_IP_LIMIT,
} from "@/lib/security/rate-limit";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string; sentAt: number }
  | { status: "error"; reason: "invalidEmail" | "notConfigured" | "rateLimited" | "unknown" };

export type VerifyState =
  | { status: "idle" }
  | { status: "error"; reason: "invalidCode" | "notConfigured" | "rateLimited" | "unknown" };

const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());

const sendSchema = z.object({
  email: emailSchema,
  // A broken draft never blocks sign-in: it is dropped.
  draft: z.string().max(4000).optional().catch(undefined),
});

const verifySchema = z.object({
  email: emailSchema,
  // Supabase codes are 6 digits by default (configurable up to 10); spaces from copy-paste are dropped.
  code: z
    .string()
    .transform((value) => value.replace(/\s+/g, ""))
    .pipe(z.string().regex(/^\d{6,10}$/)),
  // A broken draft never blocks sign-in: it is dropped.
  draft: z.string().max(4000).optional().catch(undefined),
});

/**
 * After sign-in: the service admin goes to /admin, an owner to the dashboard,
 * or to the wizard with the card they started (src/lib/domain/card-draft.ts).
 */
function nextPathFor(draft: string | undefined, email: string): string {
  if (isAdminEmail(email)) return "/admin";
  return safeNextPath(onboardingPathForDraft(draft) ?? "/dashboard");
}

function ipHashSecretOrNull(): string | null {
  try {
    return ipHashSecret();
  } catch (error) {
    if (error instanceof MissingEnvError) return null;
    throw error;
  }
}

/**
 * Step 1: Supabase emails a one-time code (the email templates show
 * {{ .Token }}, see docs/auth-email-templates.md). /auth/callback stays for
 * links from letters sent before the switch to codes.
 */
export async function sendLoginCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = sendSchema.safeParse({
    email: formData.get("email"),
    draft: formData.get("draft") ?? undefined,
  });
  if (!parsed.success) return { status: "error", reason: "invalidEmail" };
  if (!isSupabaseConfigured()) return { status: "error", reason: "notConfigured" };

  const { email, draft } = parsed.data;
  const callback = new URL("/auth/callback", siteUrl());
  callback.searchParams.set("next", nextPathFor(draft, email));

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
  });

  if (error) {
    if (error.status === 429) return { status: "error", reason: "rateLimited" };
    logEvent("error", "action_failed", { action: "sendLoginCode", status: error.status, code: error.code });
    return { status: "error", reason: "unknown" };
  }
  return { status: "sent", email, sentAt: Date.now() };
}

/**
 * Step 2: checks the code and starts the session (cookie), then redirects.
 * Every check is counted per email and per IP before Supabase sees it
 * (LOGIN_CODE_*_LIMIT), so guessing a 6-digit code is hopeless.
 */
export async function verifyLoginCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const parsed = verifySchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code") ?? "",
    draft: formData.get("draft") ?? undefined,
  });
  if (!parsed.success) return { status: "error", reason: "invalidCode" };
  if (!isSupabaseConfigured()) return { status: "error", reason: "notConfigured" };

  const admin = tryCreateSupabaseAdminClient();
  const secret = ipHashSecretOrNull();
  if (!admin || !secret) return { status: "error", reason: "notConfigured" };

  const { email, code, draft } = parsed.data;

  try {
    const emailAllowed = await hitLoginRateLimit(admin, {
      ...LOGIN_CODE_EMAIL_LIMIT,
      keyHash: hashEmail(email, secret),
    });
    const ipAllowed =
      emailAllowed &&
      (await hitLoginRateLimit(admin, {
        ...LOGIN_CODE_IP_LIMIT,
        keyHash: hashIp(clientIpFromHeaders(await headers()), secret),
      }));
    if (!emailAllowed || !ipAllowed) {
      logEvent("warn", "login_code_rejected", { reason: emailAllowed ? "rate_limit_ip" : "rate_limit_email" });
      return { status: "error", reason: "rateLimited" };
    }
  } catch (error) {
    logEvent("error", "action_failed", { action: "verifyLoginCode", error });
    return { status: "error", reason: "unknown" };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
  if (error) {
    if (error.status === 429) return { status: "error", reason: "rateLimited" };
    // Supabase answers a wrong and an expired code the same way (otp_expired).
    logEvent("warn", "login_code_failed", { status: error.status, code: error.code });
    return { status: "error", reason: "invalidCode" };
  }

  redirect(nextPathFor(draft, email));
}
