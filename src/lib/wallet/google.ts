/**
 * Google Wallet provider (docs/architecture.md §7): REST calls to the Wallet
 * Objects API with an OAuth token of the service account
 * (google-auth-library), payloads from google-payload.ts.
 *
 * 404 on an object means the customer never saved the pass — not an error.
 */
import { JWT } from "google-auth-library";

import type { GoogleWalletEnv } from "@/lib/env";

import {
  buildAddMessageBody,
  buildLoyaltyClass,
  buildLoyaltyObject,
  buildLoyaltyPoints,
  buildSaveJwtClaims,
  googleClassId,
  googleObjectId,
  GOOGLE_WALLET_API,
  GOOGLE_WALLET_SCOPE,
  saveUrlFromJwt,
  signSaveJwt,
} from "./google-payload";
import type { WalletBusiness, WalletCard, WalletMessage, WalletProgram, WalletProvider } from "./types";

const REQUEST_TIMEOUT_MS = 8_000;

export class GoogleWalletApiError extends Error {
  constructor(
    readonly status: number,
    readonly operation: string,
    detail: string,
  ) {
    super(`Google Wallet ${operation} failed: HTTP ${status} ${detail}`.trim());
    this.name = "GoogleWalletApiError";
  }
}

export interface GoogleWalletDeps {
  siteUrl: string;
  /** Injected in tests; defaults to global fetch. */
  fetch?: typeof fetch;
  /** Injected in tests; defaults to a google-auth-library JWT client. */
  getAccessToken?: () => Promise<string>;
}

const TOKEN_TIMEOUT_MS = 8_000;

function defaultTokenSource(env: GoogleWalletEnv): () => Promise<string> {
  const client = new JWT({ email: env.serviceAccountEmail, key: env.privateKey, scopes: [GOOGLE_WALLET_SCOPE] });
  return async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("Google Wallet: access token timeout")), TOKEN_TIMEOUT_MS);
    });
    try {
      const { token } = await Promise.race([client.getAccessToken(), timeout]);
      if (!token) throw new Error("Google Wallet: empty access token");
      return token;
    } finally {
      clearTimeout(timer);
    }
  };
}

export class GoogleWalletProvider implements WalletProvider {
  readonly name = "google" as const;
  private readonly fetchImpl: typeof fetch;
  private readonly getAccessToken: () => Promise<string>;
  private readonly siteUrl: string;

  constructor(
    private readonly env: GoogleWalletEnv,
    deps: GoogleWalletDeps,
  ) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.getAccessToken = deps.getAccessToken ?? defaultTokenSource(env);
    this.siteUrl = deps.siteUrl;
  }

  isConfigured(): boolean {
    return true;
  }

  classId(program: Pick<WalletProgram, "id">): string {
    return googleClassId(this.env.issuerId, program.id);
  }

  objectId(card: Pick<WalletCard, "id">): string {
    return googleObjectId(this.env.issuerId, card.id);
  }

  /** Returns the HTTP status; throws on anything but 2xx and the allowed statuses. */
  private async call(
    operation: string,
    method: "GET" | "POST" | "PATCH",
    path: string,
    body?: unknown,
    allow: readonly number[] = [],
  ): Promise<number> {
    const token = await this.getAccessToken();
    const response = await this.fetchImpl(`${GOOGLE_WALLET_API}/${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok || allow.includes(response.status)) return response.status;
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    throw new GoogleWalletApiError(response.status, operation, detail);
  }

  /** Update the class with the current design, or create it on first use. */
  async upsertClass(program: WalletProgram, business: WalletBusiness): Promise<string> {
    const payload = buildLoyaltyClass({ issuerId: this.env.issuerId, program, business, siteUrl: this.siteUrl });
    const id = encodeURIComponent(payload.id);
    const status = await this.call("patchClass", "PATCH", `loyaltyClass/${id}`, payload, [404]);
    if (status === 404) {
      // 409: created meanwhile by a parallel request — fine.
      await this.call("insertClass", "POST", "loyaltyClass", payload, [409]);
    }
    return payload.id;
  }

  async getSaveUrl(card: WalletCard, program: WalletProgram, business: WalletBusiness): Promise<string> {
    await this.upsertClass(program, business);
    const object = buildLoyaltyObject({ issuerId: this.env.issuerId, card, program, business, siteUrl: this.siteUrl });
    const claims = buildSaveJwtClaims({
      serviceAccountEmail: this.env.serviceAccountEmail,
      siteUrl: this.siteUrl,
      object,
    });
    return saveUrlFromJwt(await signSaveJwt(claims, this.env.privateKey));
  }

  async updateCard(card: WalletCard, program: WalletProgram): Promise<void> {
    const id = encodeURIComponent(this.objectId(card));
    await this.call("updateObject", "PATCH", `loyaltyObject/${id}`, buildLoyaltyPoints(card, program), [404]);
  }

  async messageCard(
    card: Pick<WalletCard, "id">,
    _program: WalletProgram,
    business: WalletBusiness,
    message: WalletMessage,
  ): Promise<void> {
    const id = encodeURIComponent(this.objectId(card));
    await this.call("objectMessage", "POST", `loyaltyObject/${id}/addMessage`, buildAddMessageBody(message, business), [404]);
  }
}
