"use server";

import { z } from "zod";

import { isNicheSlug } from "@/config/niches";
import { safeNextPath } from "@/lib/auth/redirect";
import { isSupabaseConfigured, siteUrl } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logEvent } from "@/lib/log";

export type LoginState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; reason: "invalidEmail" | "notConfigured" | "rateLimited" | "unknown" };

const schema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  niche: z.string().optional(),
});

/** Sends a Supabase magic link. The link lands on /auth/callback. */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    niche: formData.get("niche") ?? undefined,
  });
  if (!parsed.success) return { status: "error", reason: "invalidEmail" };
  if (!isSupabaseConfigured()) return { status: "error", reason: "notConfigured" };

  const { email, niche } = parsed.data;
  const next = safeNextPath(
    niche && isNicheSlug(niche) ? `/dashboard/onboarding?niche=${niche}` : "/dashboard",
  );
  const callback = new URL("/auth/callback", siteUrl());
  callback.searchParams.set("next", next);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString(), shouldCreateUser: true },
  });

  if (error) {
    if (error.status === 429) return { status: "error", reason: "rateLimited" };
    logEvent("error", "action_failed", { action: "sendMagicLink", status: error.status, code: error.code });
    return { status: "error", reason: "unknown" };
  }
  return { status: "sent", email };
}
