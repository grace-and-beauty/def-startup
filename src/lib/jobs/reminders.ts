/**
 * Daily reminders job (docs/architecture.md §5.4), called by
 * /api/cron/reminders. Kept free of Next.js APIs so it can run from a script.
 *
 * For each business with reminders turned on in its program:
 *   plan has "reminders" (hasFeature) → cards due (domain/reminders.ts) →
 *   RPC record_reminder (marks cards + messages row + recipients, atomically
 *   and idempotently) → Google Wallet message to each reminded Google pass.
 * The web card shows the reminder as the latest message for that card.
 * One failing business does not stop the others.
 */
import {
  getProgramByBusinessId,
  listBusinessesWithRemindersEnabled,
  listReminderCandidates,
  recordReminder,
} from "@/lib/data";
import { hasFeature } from "@/lib/domain/plans";
import { reminderCutoff, reminderSettings, selectCardsToRemind } from "@/lib/domain/reminders";
import type { Db } from "@/lib/supabase/types";
import type { WalletProvider } from "@/lib/wallet/types";
import { logEvent } from "@/lib/log";

export interface RemindersSummary {
  businesses: number;
  skippedByPlan: number;
  reminded: number;
  walletSent: number;
  walletFailed: number;
  failedBusinesses: number;
}

/** Google Wallet calls per business are sent in small parallel batches. */
const WALLET_BATCH = 5;

export async function runReminders(input: { admin: Db; wallet: WalletProvider; now: Date }): Promise<RemindersSummary> {
  const { admin, wallet, now } = input;
  const summary: RemindersSummary = {
    businesses: 0,
    skippedByPlan: 0,
    reminded: 0,
    walletSent: 0,
    walletFailed: 0,
    failedBusinesses: 0,
  };

  for (const business of await listBusinessesWithRemindersEnabled(admin)) {
    summary.businesses++;
    if (!hasFeature(business, "reminders", now)) {
      summary.skippedByPlan++;
      continue;
    }
    try {
      const program = await getProgramByBusinessId(admin, business.id);
      const settings = program ? reminderSettings(program) : null;
      if (!program || !settings) continue;

      const candidates = await listReminderCandidates(admin, business.id, reminderCutoff(settings.days, now));
      const due = selectCardsToRemind(candidates, program, now);
      if (due.length === 0) continue;

      const recorded = await recordReminder(admin, {
        businessId: business.id,
        text: settings.text,
        cardIds: due.map((card) => card.id),
      });
      summary.reminded += recorded.cardIds.length;
      if (!recorded.messageId || !wallet.isConfigured()) continue;

      const reminded = new Set(recorded.cardIds);
      const googleCards = due.filter((card) => reminded.has(card.id) && card.wallet_type === "google");
      const message = { id: `rem_${recorded.messageId}`, text: settings.text };
      for (let i = 0; i < googleCards.length; i += WALLET_BATCH) {
        const results = await Promise.allSettled(
          googleCards
            .slice(i, i + WALLET_BATCH)
            .map((card) => wallet.messageCard(card, program, business, message)),
        );
        for (const result of results) {
          if (result.status === "fulfilled") summary.walletSent++;
          else {
            summary.walletFailed++;
            logEvent("error", "wallet_task_failed", { task: "reminderMessage", businessId: business.id, error: result.reason });
          }
        }
      }
    } catch (error) {
      summary.failedBusinesses++;
      logEvent("error", "reminders_failed", { businessId: business.id, error });
    }
  }
  return summary;
}
