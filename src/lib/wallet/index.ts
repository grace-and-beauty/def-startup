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

export type { WalletBusiness, WalletCard, WalletMessage, WalletProgram, WalletProvider } from "./types";
export { WalletNotConfiguredError } from "./types";

let cached: { key: string; provider: WalletProvider } | null = null;

export function getWalletProvider(): WalletProvider {
  const env = googleWalletEnv();
  if (!env) return noopWalletProvider;
  // Reuse the provider (and its OAuth token cache) while the env is unchanged.
  const key = `${env.issuerId}|${env.serviceAccountEmail}|${siteUrl()}`;
  if (cached?.key !== key) {
    cached = { key, provider: new GoogleWalletProvider(env, { siteUrl: siteUrl() }) };
  }
  return cached.provider;
}

export function isGoogleWalletConfigured(): boolean {
  return googleWalletEnv() !== null;
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
    console.error(`wallet ${name} failed`, error instanceof Error ? error.message : error);
    return false;
  }
}
