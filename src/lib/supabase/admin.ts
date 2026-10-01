import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/data/types";
import { isAdminConfigured, supabasePublicEnv, supabaseServiceRoleKey } from "@/lib/env";

/**
 * Service-role client — BYPASSES RLS. Server only.
 *
 * Used by public pages (/c/[slug], /card/[token]), the staff scanner and cron.
 * Every query made with it MUST be filtered by a business_id that was derived
 * from a trusted source (slug, qr_token, signed staff session) — see
 * docs/architecture.md §4.2.
 */
let cached: SupabaseClient<Database> | undefined;

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (cached) return cached;
  const { url } = supabasePublicEnv();
  cached = createClient<Database>(url, supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return cached;
}

/** Like createSupabaseAdminClient, but null when the env is not configured (pages show a notice). */
export function tryCreateSupabaseAdminClient(): SupabaseClient<Database> | null {
  return isAdminConfigured() ? createSupabaseAdminClient() : null;
}
