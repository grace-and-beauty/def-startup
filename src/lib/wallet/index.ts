import { googleWalletEnv } from "@/lib/env";

/**
 * Wallet integration entry point (docs/architecture.md §7).
 * Stage 2 only needs to know whether the "Add to Google Wallet" button should
 * be shown; the provider interface and the Google implementation come in
 * stage 3. Without GOOGLE_WALLET_* env vars the noop provider is used and the
 * UI offers the web card only.
 */
export function isGoogleWalletConfigured(): boolean {
  return googleWalletEnv() !== null;
}

/** Route that redirects to the "Save to Google Wallet" link. */
export function googleWalletSavePath(qrToken: string): string {
  return `/api/wallet/google/${encodeURIComponent(qrToken)}`;
}
