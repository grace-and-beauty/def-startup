/**
 * Google Wallet payloads (docs/architecture.md §7) — pure functions, no
 * network: LoyaltyClass (one per program), LoyaltyObject (one per card),
 * messages and the signed "Save to Google Wallet" JWT.
 *
 * Reference: https://developers.google.com/wallet/retail/loyalty-cards/rest
 */
import { importPKCS8, SignJWT } from "jose";

import { t } from "@/lib/i18n";

import type { WalletBusiness, WalletCard, WalletMessage, WalletProgram } from "./types";

export const GOOGLE_SAVE_URL = "https://pay.google.com/gp/v/save/";
export const GOOGLE_WALLET_API = "https://walletobjects.googleapis.com/walletobjects/v1";
export const GOOGLE_WALLET_SCOPE = "https://www.googleapis.com/auth/wallet_object.issuer";
/** Neutral logo used when the business has none (Google requires programLogo). */
export const FALLBACK_LOGO_PATH = "/wallet-logo.png";

/** Id suffixes may contain only [A-Za-z0-9._-]; uuids already do. */
function idSuffix(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

export function googleClassId(issuerId: string, programId: string): string {
  return `${issuerId}.prog_${idSuffix(programId)}`;
}

export function googleObjectId(issuerId: string, cardId: string): string {
  return `${issuerId}.card_${idSuffix(cardId)}`;
}

/** Only #rrggbb is accepted by Google; anything else falls back to black. */
function hexColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value.toLowerCase() : "#111111";
}

function absoluteUrl(siteUrl: string, pathOrUrl: string): string {
  return new URL(pathOrUrl, `${siteUrl.replace(/\/+$/, "")}/`).toString();
}

interface Image {
  sourceUri: { uri: string };
  contentDescription: { defaultValue: { language: string; value: string } };
}

function localized(value: string) {
  return { defaultValue: { language: "uk", value } };
}

function logoImage(business: WalletBusiness, siteUrl: string): Image {
  return {
    sourceUri: { uri: absoluteUrl(siteUrl, business.logo_url ?? FALLBACK_LOGO_PATH) },
    contentDescription: localized(t("wallet.logoDescription", { name: business.name })),
  };
}

export interface LoyaltyClassPayload {
  id: string;
  issuerName: string;
  programName: string;
  programLogo: Image;
  hexBackgroundColor: string;
  reviewStatus: "UNDER_REVIEW";
  countryCode: string;
  multipleDevicesAndHoldersAllowedStatus: "MULTIPLE_HOLDERS";
  textModulesData: { id: string; header: string; body: string }[];
}

export function buildLoyaltyClass(input: {
  issuerId: string;
  program: WalletProgram;
  business: WalletBusiness;
  siteUrl: string;
}): LoyaltyClassPayload {
  const { issuerId, program, business, siteUrl } = input;
  const textModulesData = [
    {
      id: "reward",
      header: t("wallet.rewardHeader"),
      body: t("wallet.rewardBody", { required: program.stamps_required, reward: program.reward_text }),
    },
  ];
  if (program.terms_text) {
    textModulesData.push({ id: "terms", header: t("wallet.termsHeader"), body: program.terms_text });
  }
  return {
    id: googleClassId(issuerId, program.id),
    issuerName: business.name,
    programName: business.name,
    programLogo: logoImage(business, siteUrl),
    hexBackgroundColor: hexColor(business.bg_color),
    reviewStatus: "UNDER_REVIEW",
    countryCode: "UA",
    multipleDevicesAndHoldersAllowedStatus: "MULTIPLE_HOLDERS",
    textModulesData,
  };
}

/** Counters on the pass — also the PATCH body after a stamp / reward. */
export function buildLoyaltyPoints(card: WalletCard, program: WalletProgram) {
  return {
    loyaltyPoints: {
      label: t("wallet.stampsLabel"),
      balance: {
        string: t("wallet.stampsValue", { count: card.stamps_count, required: program.stamps_required }),
      },
    },
    secondaryLoyaltyPoints: {
      label: t("wallet.rewardsLabel"),
      balance: { int: Math.max(0, card.rewards_available) },
    },
  };
}

export interface LoyaltyObjectPayload extends ReturnType<typeof buildLoyaltyPoints> {
  id: string;
  classId: string;
  state: "ACTIVE";
  accountId: string;
  accountName: string;
  barcode: { type: "QR_CODE"; value: string; alternateText: string };
  linksModuleData: { uris: { id: string; uri: string; description: string }[] };
}

/** Short human-readable pass number (from the card id, not the secret token). */
export function passNumber(cardId: string): string {
  return cardId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export function buildLoyaltyObject(input: {
  issuerId: string;
  card: WalletCard;
  program: WalletProgram;
  business: WalletBusiness;
  siteUrl: string;
}): LoyaltyObjectPayload {
  const { issuerId, card, program, business, siteUrl } = input;
  return {
    id: googleObjectId(issuerId, card.id),
    classId: googleClassId(issuerId, program.id),
    state: "ACTIVE",
    // The QR carries the same token as the web card, so the scanner reads both.
    // The token is the customer's credential: never print any part of it —
    // the visible number is derived from the card id instead.
    accountId: passNumber(card.id),
    accountName: card.customer?.name?.trim() || business.name,
    barcode: { type: "QR_CODE", value: card.qr_token, alternateText: passNumber(card.id) },
    ...buildLoyaltyPoints(card, program),
    linksModuleData: {
      uris: [
        {
          id: "web_card",
          uri: absoluteUrl(siteUrl, `/card/${encodeURIComponent(card.qr_token)}`),
          description: t("wallet.webCardLink"),
        },
      ],
    },
  };
}

/** Body of loyaltyClass/{id}/addMessage and loyaltyObject/{id}/addMessage. */
export function buildAddMessageBody(message: WalletMessage, business: Pick<WalletBusiness, "name">) {
  return {
    message: {
      id: idSuffix(message.id),
      header: business.name,
      body: message.text,
      // Shows on the lock screen (Google limits notifications per pass per day).
      messageType: "TEXT_AND_NOTIFY",
    },
  };
}

export interface SaveJwtClaims {
  iss: string;
  aud: "google";
  typ: "savetowallet";
  origins: string[];
  payload: { loyaltyObjects: LoyaltyObjectPayload[] };
}

export function buildSaveJwtClaims(input: {
  serviceAccountEmail: string;
  siteUrl: string;
  object: LoyaltyObjectPayload;
}): SaveJwtClaims {
  return {
    iss: input.serviceAccountEmail,
    aud: "google",
    typ: "savetowallet",
    origins: [new URL(input.siteUrl).origin],
    payload: { loyaltyObjects: [input.object] },
  };
}

/** RS256 with the service account's PKCS#8 PEM key. */
export async function signSaveJwt(claims: SaveJwtClaims, privateKeyPem: string, now = new Date()): Promise<string> {
  const key = await importPKCS8(privateKeyPem, "RS256");
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .sign(key);
}

export function saveUrlFromJwt(jwt: string): string {
  return `${GOOGLE_SAVE_URL}${jwt}`;
}
