import type { Db } from "@/lib/supabase/types";

import { unwrap, unwrapRequired } from "./errors";
import type {
  ApplyStampResult,
  Card,
  Customer,
  RedeemRewardResult,
  TablesUpdate,
  WalletType,
} from "./types";

export type CardWithCustomer = Card & {
  customer: Pick<Customer, "id" | "name" | "phone"> | null;
};

const CARD_WITH_CUSTOMER = "*, customer:customers(id, name, phone)" as const;

/**
 * Look a card up by its QR token. Pass businessId whenever it is known
 * (scanner: from the staff session) so a token of another business never
 * matches.
 */
export async function getCardByToken(
  db: Db,
  qrToken: string,
  businessId?: string,
): Promise<CardWithCustomer | null> {
  let query = db.from("cards").select(CARD_WITH_CUSTOMER).eq("qr_token", qrToken);
  if (businessId) query = query.eq("business_id", businessId);
  const row = unwrap("getCardByToken", await query.maybeSingle());
  return row as CardWithCustomer | null;
}

export async function getCardById(
  db: Db,
  businessId: string,
  cardId: string,
): Promise<CardWithCustomer | null> {
  const row = unwrap(
    "getCardById",
    await db
      .from("cards")
      .select(CARD_WITH_CUSTOMER)
      .eq("business_id", businessId)
      .eq("id", cardId)
      .maybeSingle(),
  );
  return row as CardWithCustomer | null;
}

/** qrToken must come from src/lib/security/tokens.ts (≥128 bit, base62). */
export async function createCard(
  db: Db,
  input: { businessId: string; programId: string; customerId: string; qrToken: string },
): Promise<Card> {
  return unwrapRequired(
    "createCard",
    await db
      .from("cards")
      .insert({
        business_id: input.businessId,
        program_id: input.programId,
        customer_id: input.customerId,
        qr_token: input.qrToken,
      })
      .select("*")
      .single(),
  );
}

export async function countCards(db: Db, businessId: string, since?: Date): Promise<number> {
  let query = db
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if (since) query = query.gte("created_at", since.toISOString());
  const { count, error } = await query;
  unwrap("countCards", { data: null, error });
  return count ?? 0;
}

/** All cards of a business (for reminders / at-risk broadcasts). */
export async function listCards(db: Db, businessId: string): Promise<Card[]> {
  return (
    unwrap(
      "listCards",
      await db
        .from("cards")
        .select("*")
        .eq("business_id", businessId)
        .order("created_at", { ascending: true }),
    ) ?? []
  );
}

export async function setCardWallet(
  db: Db,
  businessId: string,
  cardId: string,
  wallet: { type: WalletType; googleObjectId?: string | null },
): Promise<void> {
  const patch: TablesUpdate<"cards"> = { wallet_type: wallet.type };
  if (wallet.googleObjectId !== undefined) patch.google_object_id = wallet.googleObjectId;
  unwrap(
    "setCardWallet",
    await db.from("cards").update(patch).eq("business_id", businessId).eq("id", cardId),
  );
}

export async function markCardsReminded(
  db: Db,
  businessId: string,
  cardIds: string[],
  at: Date,
): Promise<void> {
  if (cardIds.length === 0) return;
  unwrap(
    "markCardsReminded",
    await db
      .from("cards")
      .update({ last_reminder_at: at.toISOString() })
      .eq("business_id", businessId)
      .in("id", cardIds),
  );
}

/**
 * Transactional stamp (RPC apply_stamp, row lock + cooldown re-check).
 * Business rules are documented in supabase/migrations/*_rpc_stamps.sql.
 */
export async function applyStamp(
  db: Db,
  input: { businessId: string; cardId: string; staffId?: string | null; cooldownMinutes: number },
): Promise<ApplyStampResult> {
  const rows = unwrapRequired(
    "applyStamp",
    await db.rpc("apply_stamp", {
      p_business_id: input.businessId,
      p_card_id: input.cardId,
      p_staff_id: input.staffId ?? null,
      p_cooldown_minutes: input.cooldownMinutes,
    }),
  );
  const [row] = rows;
  if (!row) throw new Error("applyStamp: empty result");
  return row;
}

export async function redeemReward(
  db: Db,
  input: { businessId: string; cardId: string; staffId?: string | null },
): Promise<RedeemRewardResult> {
  const rows = unwrapRequired(
    "redeemReward",
    await db.rpc("redeem_reward", {
      p_business_id: input.businessId,
      p_card_id: input.cardId,
      p_staff_id: input.staffId ?? null,
    }),
  );
  const [row] = rows;
  if (!row) throw new Error("redeemReward: empty result");
  return row;
}
