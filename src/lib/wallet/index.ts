/**
 * Wallet integration entry point (docs/architecture.md §7): picks the Google
 * provider when GOOGLE_WALLET_* env vars are set, the noop provider otherwise.
 *
 * Wallet errors never undo the main operation (a stamp, a broadcast): run
 * side calls through runWalletTask() / scheduleWalletTask(), which log and
 * swallow failures.
 */
import "server-only";

import { googleWalletEnv, siteUrl } from "@/lib/env";

import { GoogleWalletProvider } from "./google";
import { noopWalletProvider } from "./noop";
import type { WalletProvider } from "./types";
import { logEvent } from "@/lib/log";

export type { WalletBusiness, WalletCard, WalletMessage, WalletProgram, WalletProvider } from "./types";
export { WalletNotConfiguredError } from "./types";

let cached: { key: string; provider: WalletProvider } | null = null;

export function getWalletProvider(): WalletProvider {
  const env = googleWalletEnv();
  if (!env) return noopWalletProvider;
  // Passes link to the web card, show the logo and sign JWT origins with the
  // site URL: a localhost / http URL would produce broken passes.
  if (!siteUrl().startsWith("https://")) {
    warnInsecureSiteUrl();
    return noopWalletProvider;
  }
  // Reuse the provider (and its OAuth token cache) while the env is unchanged.
  const key = `${env.issuerId}|${env.serviceAccountEmail}|${siteUrl()}`;
  if (cached?.key !== key) {
    cached = { key, provider: new GoogleWalletProvider(env, { siteUrl: siteUrl() }) };
  }
  return cached.provider;
}

export function isGoogleWalletConfigured(): boolean {
  return getWalletProvider().isConfigured();
}

let warned = false;
function warnInsecureSiteUrl(): void {
  if (warned) return;
  warned = true;
  logEvent("warn", "wallet_task_failed", { task: "config", reason: "NEXT_PUBLIC_SITE_URL must be https — Google Wallet disabled" });
}

/** Route that redirects to the "Save to Google Wallet" link. */
export function googleWalletSavePath(qrToken: string): string {
  return `/api/wallet/google/${encodeURIComponent(qrToken)}`;
}

/** Runs a wallet side call; failures are logged, never thrown. Returns success. */
export async function runWalletTask(
  name: string,
  task: (wallet: WalletProvider) => Promise<void>,
): Promise<boolean> {
  const wallet = getWalletProvider();
  if (!wallet.isConfigured()) return true;
  try {
    await task(wallet);
    return true;
  } catch (error) {
    logEvent("error", "wallet_task_failed", { task: name, error });
    return false;
  }
}
