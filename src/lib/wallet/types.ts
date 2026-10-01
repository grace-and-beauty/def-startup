import type { BusinessPublic } from "@/lib/data/businesses";
import type { ProgramPublic } from "@/lib/data/programs";
import type { Card, Customer } from "@/lib/data/types";

/** Card fields a wallet pass needs (a CardWithCustomer row fits). */
export type WalletCard = Pick<Card, "id" | "qr_token" | "stamps_count" | "rewards_available"> & {
  customer?: Pick<Customer, "name"> | null;
};

/** Program fields a wallet pass needs (ProgramPublic or a full Program row fit). */
export type WalletProgram = Pick<ProgramPublic, "id" | "stamps_required" | "reward_text" | "terms_text">;

/** Business fields a wallet pass needs (BusinessPublic or a full Business row fit). */
export type WalletBusiness = Pick<
  BusinessPublic,
  "id" | "name" | "slug" | "logo_url" | "bg_color" | "fg_color" | "label_color"
>;

/** A message shown on the pass (and on the lock screen for Google Wallet). */
export interface WalletMessage {
  /** Stable id — sending the same id twice does not duplicate the message. */
  id: string;
  text: string;
}

/**
 * Wallet integration (docs/architecture.md §7). Implementations: Google
 * (google.ts) and noop (noop.ts, when GOOGLE_WALLET_* env is missing).
 * Apple Wallet would be one more implementation.
 *
 * Methods other than getSaveUrl never matter for the main operation: callers
 * run them via runWalletTask()/scheduleWalletTask() which log and swallow errors.
 */
export interface WalletProvider {
  readonly name: "google" | "noop";
  isConfigured(): boolean;
  /** Creates / updates the class and returns the "Save to wallet" link. */
  getSaveUrl(card: WalletCard, program: WalletProgram, business: WalletBusiness): Promise<string>;
  /** Pass id stored in cards.google_object_id after a save link was issued. */
  objectId(card: Pick<WalletCard, "id">): string | null;
  /** Class id stored in programs.google_class_id. */
  classId(program: Pick<WalletProgram, "id">): string | null;
  /** After a stamp / reward: refresh the counters on the pass. */
  updateCard(card: WalletCard, program: WalletProgram, business: WalletBusiness): Promise<void>;
  /** Message to every pass of the program. */
  broadcast(program: WalletProgram, business: WalletBusiness, message: WalletMessage): Promise<void>;
  /** Message to one pass (at-risk broadcast, reminder). */
  messageCard(
    card: Pick<WalletCard, "id">,
    program: WalletProgram,
    business: WalletBusiness,
    message: WalletMessage,
  ): Promise<void>;
}

export class WalletNotConfiguredError extends Error {
  constructor() {
    super("Wallet provider is not configured");
    this.name = "WalletNotConfiguredError";
  }
}
