import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getBusinessByOwner, getProgramByBusinessId, type Business, type Program } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient, type SupabaseServerClient } from "@/lib/supabase/server";

/**
 * Owner session (Supabase Auth cookie) for /dashboard pages and their Server
 * Actions. Data is read with the owner's client, so RLS limits every query
 * to the owner's own business.
 *
 * Pages call these helpers themselves (not only the layout): layouts are not
 * re-rendered on client navigation, and Server Actions are reachable directly.
 */

export interface OwnerSession {
  supabase: SupabaseServerClient;
  user: Pick<User, "id" | "email">;
}

export interface OwnerContext extends OwnerSession {
  business: Business;
  program: Program;
}

/** Verified user (auth.getUser() validates the JWT with Supabase Auth) or null. */
export const getOwnerSession = cache(async (): Promise<OwnerSession | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: { id: data.user.id, email: data.user.email } };
});

/** The owner's business + program (null until onboarding created them). */
export const getOwnerBusiness = cache(
  async (): Promise<{ business: Business; program: Program | null } | null> => {
    const session = await getOwnerSession();
    if (!session) return null;
    const business = await getBusinessByOwner(session.supabase, session.user.id);
    if (!business) return null;
    const program = await getProgramByBusinessId(session.supabase, business.id);
    return { business, program };
  },
);

/** Pages: signed-in owner or redirect to /login. */
export async function requireOwnerSession(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session) redirect("/login");
  return session;
}

/** Pages: owner with a finished onboarding, otherwise redirect to the wizard. */
export async function requireOwnerContext(): Promise<OwnerContext> {
  const session = await requireOwnerSession();
  const owned = await getOwnerBusiness();
  if (!owned || !owned.program || !owned.business.onboarding_done) {
    redirect("/dashboard/onboarding");
  }
  return { ...session, business: owned.business, program: owned.program };
}

/**
 * Server Actions: same checks, but returns null instead of redirecting so the
 * action can answer with an error state.
 */
export async function ownerContextForAction(): Promise<OwnerContext | null> {
  const session = await getOwnerSession();
  if (!session) return null;
  const owned = await getOwnerBusiness();
  if (!owned || !owned.program || !owned.business.onboarding_done) return null;
  return { ...session, business: owned.business, program: owned.program };
}
