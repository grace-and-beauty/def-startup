"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/lib/data/types";

/**
 * Browser Supabase client (anon key + owner session cookie). Used only for
 * auth flows on the client; data access goes through Server Actions.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example)",
    );
  }
  return createBrowserClient<Database>(url, anonKey);
}
