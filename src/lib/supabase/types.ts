import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/data/types";

/** Any typed Supabase client (owner session, service role or browser). */
export type Db = SupabaseClient<Database>;
