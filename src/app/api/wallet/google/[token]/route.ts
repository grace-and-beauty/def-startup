import { NextResponse, type NextRequest } from "next/server";

import { getCardByToken, getPublicBusinessById, getPublicProgramByBusinessId, hitRateLimit, setCardWallet, updateProgramGoogleClass } from "@/lib/data";
import { canStamp } from "@/lib/domain/plans";
import { ipHashSecret, MissingEnvError } from "@/lib/env";
import { clientIpFromHeaders, hashIp, WALLET_SAVE_RATE_LIMIT } from "@/lib/security/rate-limit";
import { isValidQrToken } from "@/lib/security/tokens";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";
import { getWalletProvider } from "@/lib/wallet";

/**
 * "Add to Google Wallet" (architecture §5.1): upserts the program's
 * LoyaltyClass, signs a JWT with the card's LoyaltyObject and redirects to
 * pay.google.com. Any problem → back to the web card, which always works.
 *
 * Knowing the qr_token is the access check (same as /card/[token]).
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/wallet/google/[token]">) {
  const { token } = await ctx.params;
  if (!isValidQrToken(token)) return new NextResponse(null, { status: 404 });

  const cardUrl = new URL(`/card/${encodeURIComponent(token)}`, request.url);
  const back = (error = false) => {
    if (error) cardUrl.searchParams.set("wallet", "error");
    return noStore(NextResponse.redirect(cardUrl, 303));
  };

  const wallet = getWalletProvider();
  const admin = tryCreateSupabaseAdminClient();
  if (!wallet.isConfigured() || !admin) return back();

  try {
    const card = await getCardByToken(admin, token);
    if (!card) return new NextResponse(null, { status: 404 });
    const [business, program] = await Promise.all([
      getPublicBusinessById(admin, card.business_id),
      getPublicProgramByBusinessId(admin, card.business_id),
    ]);
    if (!business || !program) return new NextResponse(null, { status: 404 });
    // Inactive business (§6.2): the web card stays viewable, no new passes.
    if (!canStamp(business, new Date())) return back();

    const allowed = await hitRateLimit(admin, {
      scope: WALLET_SAVE_RATE_LIMIT.scope,
      businessId: business.id,
      keyHash: hashIp(clientIpFromHeaders(request.headers), ipHashSecret()),
      max: WALLET_SAVE_RATE_LIMIT.max,
      windowSeconds: WALLET_SAVE_RATE_LIMIT.windowSeconds,
    });
    if (!allowed) return back(true);

    const saveUrl = await wallet.getSaveUrl(card, program, business);
    await Promise.all([
      setCardWallet(admin, business.id, card.id, { type: "google", googleObjectId: wallet.objectId(card) }),
      updateProgramGoogleClass(admin, business.id, program.id, wallet.classId(program)),
    ]);
    return noStore(NextResponse.redirect(saveUrl, 303));
  } catch (error) {
    if (!(error instanceof MissingEnvError)) {
      console.error("wallet save link failed", error instanceof Error ? error.message : error);
    }
    return back(true);
  }
}

function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  response.headers.set("referrer-policy", "no-referrer");
  return response;
}
