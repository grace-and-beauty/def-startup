import { WalletNotConfiguredError, type WalletProvider } from "./types";

/**
 * Used when GOOGLE_WALLET_* is not set (local development, tests): the UI
 * hides the "Add to Google Wallet" button and the web card is the only card.
 */
export const noopWalletProvider: WalletProvider = {
  name: "noop",
  isConfigured: () => false,
  getSaveUrl: async () => {
    throw new WalletNotConfiguredError();
  },
  objectId: () => null,
  classId: () => null,
  updateCard: async () => undefined,
  messageCard: async () => undefined,
};
