import { exportPKCS8, exportSPKI, generateKeyPair, importSPKI, jwtVerify } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { GoogleWalletApiError, GoogleWalletProvider } from "@/lib/wallet/google";
import {
  buildAddMessageBody,
  buildLoyaltyClass,
  buildLoyaltyObject,
  buildSaveJwtClaims,
  googleClassId,
  googleObjectId,
  GOOGLE_SAVE_URL,
  signSaveJwt,
} from "@/lib/wallet/google-payload";
import { noopWalletProvider } from "@/lib/wallet/noop";
import { WalletNotConfiguredError } from "@/lib/wallet/types";

const ISSUER = "3388000000012345678";
const SITE = "https://cards.example.com";
const business = {
  id: "b1",
  name: "Автомийка Демо",
  slug: "demo",
  logo_url: null,
  bg_color: "#1A2B3C",
  fg_color: "#ffffff",
  label_color: "#bbbbbb",
};
const program = {
  id: "11111111-2222-4333-8444-555555555555",
  stamps_required: 6,
  reward_text: "Безкоштовна мийка",
  terms_text: "Одна картка на авто",
};
const card = {
  id: "99999999-8888-4777-8666-555555555555",
  qr_token: "AbCdEfGhIjKlMnOpQrStUv",
  stamps_count: 4,
  rewards_available: 1,
  customer: { name: "Олена" },
};

let privateKey: string;
let publicKey: string;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256", { extractable: true });
  privateKey = await exportPKCS8(pair.privateKey);
  publicKey = await exportSPKI(pair.publicKey);
});

describe("google wallet payloads", () => {
  it("builds ids from the issuer and our uuids", () => {
    expect(googleClassId(ISSUER, program.id)).toBe(`${ISSUER}.prog_${program.id}`);
    expect(googleObjectId(ISSUER, card.id)).toBe(`${ISSUER}.card_${card.id}`);
    expect(googleObjectId(ISSUER, "a b/c")).toBe(`${ISSUER}.card_a_b_c`);
  });

  it("class: business design, reward rule, fallback logo", () => {
    const cls = buildLoyaltyClass({ issuerId: ISSUER, program, business, siteUrl: SITE });
    expect(cls).toMatchObject({
      id: `${ISSUER}.prog_${program.id}`,
      issuerName: "Автомийка Демо",
      programName: "Автомийка Демо",
      hexBackgroundColor: "#1a2b3c",
      reviewStatus: "UNDER_REVIEW",
      countryCode: "UA",
    });
    expect(cls.programLogo.sourceUri.uri).toBe(`${SITE}/wallet-logo.png`);
    expect(cls.textModulesData.map((m) => m.id)).toEqual(["reward", "terms"]);
    expect(cls.textModulesData[0].body).toContain("6");
    expect(cls.textModulesData[0].body).toContain("Безкоштовна мийка");

    const withLogo = buildLoyaltyClass({
      issuerId: ISSUER,
      program: { ...program, terms_text: null },
      business: { ...business, logo_url: "https://cdn.example.com/logo.png", bg_color: "red" },
      siteUrl: SITE,
    });
    expect(withLogo.programLogo.sourceUri.uri).toBe("https://cdn.example.com/logo.png");
    expect(withLogo.hexBackgroundColor).toBe("#111111");
    expect(withLogo.textModulesData).toHaveLength(1);
  });

  it("object: progress 'N / M', rewards, QR with the card token, web card link", () => {
    const obj = buildLoyaltyObject({ issuerId: ISSUER, card, program, business, siteUrl: SITE });
    expect(obj.id).toBe(`${ISSUER}.card_${card.id}`);
    expect(obj.classId).toBe(`${ISSUER}.prog_${program.id}`);
    expect(obj.loyaltyPoints.balance.string).toBe("4 / 6");
    expect(obj.secondaryLoyaltyPoints.balance.int).toBe(1);
    expect(obj.barcode).toMatchObject({ type: "QR_CODE", value: card.qr_token });
    expect(obj.accountName).toBe("Олена");
    expect(obj.linksModuleData.uris[0].uri).toBe(`${SITE}/card/${card.qr_token}`);
    expect(buildLoyaltyObject({ issuerId: ISSUER, card: { ...card, customer: null }, program, business, siteUrl: SITE }).accountName).toBe(
      business.name,
    );
  });

  it("message body", () => {
    expect(buildAddMessageBody({ id: "msg_1-2", text: "Знижка 20%" }, business)).toEqual({
      message: { id: "msg_1-2", header: business.name, body: "Знижка 20%", messageType: "TEXT_AND_NOTIFY" },
    });
  });

  it("save JWT: RS256, aud google, savetowallet, origin of the site", async () => {
    const object = buildLoyaltyObject({ issuerId: ISSUER, card, program, business, siteUrl: SITE });
    const claims = buildSaveJwtClaims({ serviceAccountEmail: "sa@proj.iam.gserviceaccount.com", siteUrl: `${SITE}/`, object });
    const jwt = await signSaveJwt(claims, privateKey);
    const { payload, protectedHeader } = await jwtVerify(jwt, await importSPKI(publicKey, "RS256"), {
      audience: "google",
      issuer: "sa@proj.iam.gserviceaccount.com",
    });
    expect(protectedHeader.alg).toBe("RS256");
    expect(payload.typ).toBe("savetowallet");
    expect(payload.origins).toEqual([SITE]);
    expect((payload.payload as { loyaltyObjects: unknown[] }).loyaltyObjects).toEqual([object]);
    expect(typeof payload.iat).toBe("number");
  });
});

function mockFetch(responses: Record<string, number>) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const path = String(url).replace("https://walletobjects.googleapis.com/walletobjects/v1/", "");
    calls.push({ method, url: path, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(responses).find((k) => `${method} ${path}`.startsWith(k));
    const status = key ? responses[key] : 200;
    return new Response(status === 204 ? null : "{}", { status });
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

function provider(fetchImpl: typeof fetch) {
  return new GoogleWalletProvider(
    { issuerId: ISSUER, serviceAccountEmail: "sa@proj.iam.gserviceaccount.com", privateKey },
    { siteUrl: SITE, fetch: fetchImpl, getAccessToken: async () => "test-token" },
  );
}

describe("GoogleWalletProvider", () => {
  it("getSaveUrl creates the class on first use and returns a pay.google.com link", async () => {
    const { calls, fetchImpl } = mockFetch({ "PATCH loyaltyClass/": 404 });
    const url = await provider(fetchImpl).getSaveUrl(card, program, business);
    expect(url.startsWith(GOOGLE_SAVE_URL)).toBe(true);
    expect(calls.map((c) => `${c.method} ${c.url.split("/")[0]}`)).toEqual(["PATCH loyaltyClass", "POST loyaltyClass"]);
    expect(calls[0].url).toBe(`loyaltyClass/${encodeURIComponent(`${ISSUER}.prog_${program.id}`)}`);
  });

  it("getSaveUrl updates an existing class only once", async () => {
    const { calls, fetchImpl } = mockFetch({});
    await provider(fetchImpl).getSaveUrl(card, program, business);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("PATCH");
  });

  it("updateCard patches counters; a pass that was never saved (404) is fine", async () => {
    const { calls, fetchImpl } = mockFetch({ "PATCH loyaltyObject/": 404 });
    await expect(provider(fetchImpl).updateCard(card, program)).resolves.toBeUndefined();
    expect(calls[0].body).toMatchObject({ loyaltyPoints: { balance: { string: "4 / 6" } } });
  });

  it("messageCard → object addMessage (no class-wide messages: consent is per customer)", async () => {
    const { calls, fetchImpl } = mockFetch({});
    const p = provider(fetchImpl);
    await p.messageCard({ id: card.id }, program, business, { id: "rem_1", text: "Скучили" });
    expect(calls.map((c) => c.url)).toEqual([`loyaltyObject/${encodeURIComponent(`${ISSUER}.card_${card.id}`)}/addMessage`]);
    expect(calls[0].body).toMatchObject({ message: { body: "Скучили" } });
    expect("broadcast" in p).toBe(false);
  });

  it("other HTTP errors are thrown (callers log them)", async () => {
    const { fetchImpl } = mockFetch({ "POST loyaltyObject/": 500 });
    await expect(
      provider(fetchImpl).messageCard({ id: card.id }, program, business, { id: "m", text: "x" }),
    ).rejects.toBeInstanceOf(GoogleWalletApiError);
  });

  it("sends the OAuth token", async () => {
    const { fetchImpl } = mockFetch({});
    await provider(fetchImpl).updateCard(card, program);
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-token");
  });
});

describe("noop wallet provider", () => {
  it("is not configured, refuses save links and ignores updates", async () => {
    expect(noopWalletProvider.isConfigured()).toBe(false);
    await expect(noopWalletProvider.getSaveUrl(card, program, business)).rejects.toBeInstanceOf(WalletNotConfiguredError);
    await expect(noopWalletProvider.updateCard(card, program, business)).resolves.toBeUndefined();
    await expect(noopWalletProvider.messageCard(card, program, business, { id: "m", text: "x" })).resolves.toBeUndefined();
    expect(noopWalletProvider.objectId(card)).toBeNull();
  });
});
