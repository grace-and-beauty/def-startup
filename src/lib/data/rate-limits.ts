import type { Db } from "@/lib/supabase/types";

import { unwrapRequired } from "./errors";

/**
 * Sliding-window rate limit (RPC hit_rate_limit, service role only).
 * Records a hit and returns true, or returns false when `max` hits already
 * happened within `windowSeconds` for (scope, business, keyHash).
 * keyHash must already be hashed (src/lib/security/rate-limit.ts) — never a raw IP.
 */
export async function hitRateLimit(
  admin: Db,
  input: { scope: string; businessId: string; keyHash: string; max: number; windowSeconds: number },
): Promise<boolean> {
  return unwrapRequired(
    "hitRateLimit",
    await admin.rpc("hit_rate_limit", {
      p_scope: input.scope,
      p_business_id: input.businessId,
      p_key_hash: input.keyHash,
      p_max: input.max,
      p_window_seconds: input.windowSeconds,
    }),
  );
}

/**
 * Same sliding window for owner sign-in (RPC hit_login_rate_limit, service
 * role only): counters keyed by a hashed email or IP, not by business.
 */
export async function hitLoginRateLimit(
  admin: Db,
  input: { scope: string; keyHash: string; max: number; windowSeconds: number },
): Promise<boolean> {
  return unwrapRequired(
    "hitLoginRateLimit",
    await admin.rpc("hit_login_rate_limit", {
      p_scope: input.scope,
      p_key_hash: input.keyHash,
      p_max: input.max,
      p_window_seconds: input.windowSeconds,
    }),
  );
}
