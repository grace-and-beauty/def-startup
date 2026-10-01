import { NextResponse, type NextRequest } from "next/server";

import { cronSecret } from "@/lib/env";
import { runReminders } from "@/lib/jobs/reminders";
import { isAuthorizedCronRequest } from "@/lib/security/cron";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWalletProvider } from "@/lib/wallet";

/** Many businesses × Google calls: allow more than the default duration. */
export const maxDuration = 300;

/**
 * Daily reminders (vercel.json: 0 8 * * * UTC). Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`; without CRON_SECRET the endpoint is
 * closed (503), with a wrong token it answers 401.
 */
export async function GET(request: NextRequest) {
  const secret = cronSecret();
  if (!secret) return json({ error: "not_configured" }, 503);
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) {
    return json({ error: "unauthorized" }, 401);
  }

  const admin = tryCreateSupabaseAdminClient();
  if (!admin) return json({ error: "not_configured" }, 503);

  try {
    const summary = await runReminders({ admin, wallet: getWalletProvider(), now: new Date() });
    return json({ ok: true, ...summary }, 200);
  } catch (error) {
    console.error("cron reminders failed", error instanceof Error ? error.message : error);
    return json({ error: "failed" }, 500);
  }
}

function json(body: unknown, status: number): NextResponse {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });
}
