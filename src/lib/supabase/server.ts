import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/data/types";
import { supabasePublicEnv } from "@/lib/env";

/**
 * Supabase client bound to the current request's auth cookies (owner session).
 * Runs as role "authenticated" (or "anon"), so RLS applies.
 * Use in Server Components, Server Actions and Route Handlers.
 */
export async function createSupabaseServerClient() {
  const { url, anonKey } = supabasePublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component: cookies are read-only there.
          // Session refresh then happens on the next Server Action / Route Handler.
        }
      },
    },
  });
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
