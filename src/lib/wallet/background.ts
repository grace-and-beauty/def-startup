import "server-only";

import { after } from "next/server";

import { getWalletProvider, runWalletTask, type WalletProvider } from "./index";

/**
 * Runs a wallet side call after the response is sent (next/server after()),
 * so the scanner / dashboard never wait for Google. Errors are logged only.
 * Skipped entirely with the noop provider.
 */
export function scheduleWalletTask(name: string, task: (wallet: WalletProvider) => Promise<void>): void {
  if (!getWalletProvider().isConfigured()) return;
  after(async () => {
    await runWalletTask(name, task);
  });
}
