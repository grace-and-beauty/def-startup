import { randomUUID } from "node:crypto";

import { devices, expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  adminClient,
  createOwner,
  deleteOwner,
  LOGO_PNG,
  signIn,
  supabaseConfigured,
  t,
  type TestOwner,
} from "./support";

/**
 * The whole product on one throwaway business, in order: the owner sets it up,
 * a customer joins, staff stamp the card to a reward, the owner messages
 * customers and reads the dashboard. Each actor has its own browser context
 * (its own phone). Everything is deleted afterwards.
 */
test.describe.configure({ mode: "serial" });
test.skip(!supabaseConfigured(), "needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");

const run = randomUUID().slice(0, 8);
const business = { name: `E2E Мийка ${run}`, slug: `e2e-${run}`, pin: "4826", stamps: 2 };
const customerName = `Клієнт ${run}`;
const broadcast = `Знижка 20% цього тижня ${run}`;

let admin: SupabaseClient;
let ownerAccount: TestOwner | undefined;
const contexts: BrowserContext[] = [];
let owner: Page;
let customer: Page;
let staff: Page;
let cardToken: string;
const pageErrors: string[] = [];

async function phone(browser: Browser, baseURL: string | undefined): Promise<Page> {
  const context = await browser.newContext({ ...devices["Pixel 7"], baseURL });
  contexts.push(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => pageErrors.push(`${page.url()}: ${error.message}`));
  return page;
}

test.beforeAll(async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  admin = adminClient();
  ownerAccount = await createOwner(admin);
  owner = await phone(browser, baseURL);
  customer = await phone(browser, baseURL);
  staff = await phone(browser, baseURL);
});

test.afterAll(async () => {
  await Promise.all(contexts.map((c) => c.close()));
  await deleteOwner(admin, ownerAccount);
});

test.afterEach(() => {
  expect(pageErrors, "uncaught errors in the page").toEqual([]);
});

test("owner signs in and sets up the business in the wizard", async () => {
  await signIn(owner, admin, ownerAccount!, "/dashboard/onboarding");
  await expect(owner.getByRole("heading", { name: t("onboarding.nicheTitle") })).toBeVisible();
  const next = owner.getByRole("button", { name: t("common.next") });

  await owner.getByRole("radio").first().click();
  await next.click();

  await owner.locator("#name").fill(business.name);
  await owner.locator("#slug").fill(business.slug);
  await next.click();

  await owner.locator("#logo").setInputFiles(LOGO_PNG);
  await next.click();

  await owner.locator("#stampsRequired").fill(String(business.stamps));
  await next.click();

  await owner.locator("#pin").fill(business.pin);
  await owner.locator("#pinConfirm").fill(business.pin);
  await owner.getByRole("button", { name: t("onboarding.finish") }).click();

  await expect(owner.getByRole("heading", { name: t("onboarding.doneTitle") })).toBeVisible();
  await expect(owner.getByText(t("onboarding.logoFailed"))).toHaveCount(0);
});

test("customer joins from the QR page and gets a web card", async () => {
  await customer.goto(`/c/${business.slug}`);
  await expect(customer.getByText(business.name).first()).toBeVisible();
  await customer.locator("#name").fill(customerName);
  await customer.getByRole("button", { name: t("join.submit") }).click();

  await expect(customer.getByRole("heading", { name: t("join.successTitle") })).toBeVisible();
  await customer.getByRole("link", { name: t("join.openWebCard") }).click();
  await expect(customer).toHaveURL(/\/card\/[^/]+$/);
  cardToken = new URL(customer.url()).pathname.split("/").pop()!;

  await expect(customer.getByText(t("webCard.remaining", { count: business.stamps }))).toBeVisible();
  await expect(customer.getByText(customerName)).toBeVisible();
});

test("staff log in with the PIN, a wrong PIN is refused", async () => {
  await staff.goto(`/scan/${business.slug}`);
  const pin = staff.getByLabel(t("scan.pin"));
  const submit = staff.getByRole("button", { name: t("scan.pinSubmit") });

  await pin.fill("0000");
  await submit.click();
  await expect(staff.getByText(t("scan.pinInvalid"))).toBeVisible();

  await pin.fill(business.pin);
  await submit.click();
  await expect(staff.getByText(t("scan.signedInAs", { name: t("onboarding.defaultStaffName") }))).toBeVisible();
});

async function findCard(): Promise<void> {
  await staff.locator("#manual-code").fill(cardToken);
  await staff.getByRole("button", { name: t("scan.manualSubmit") }).click();
  await expect(staff.getByRole("heading", { name: customerName })).toBeVisible();
}

/** The result screen also closes by itself after a few seconds — tap it if it is still there. */
async function dismissResult(): Promise<void> {
  const overlay = staff.getByText(t("scan.tapToContinue"));
  await overlay.click({ timeout: 2_000 }).catch(() => undefined);
  await expect(overlay).toHaveCount(0);
}

test("staff stamp the card to a reward, the customer sees it, staff hand it out", async () => {
  await findCard();
  await expect(staff.getByText(t("scan.progress", { count: 0, total: business.stamps }))).toBeVisible();
  await staff.getByRole("button", { name: t("scan.addStamp") }).click();
  await expect(staff.getByText(t("stamp.status.ok"))).toBeVisible();
  await expect(staff.getByText(t("scan.progress", { count: 1, total: business.stamps }))).toBeVisible();
  await dismissResult();

  await findCard();
  await staff.getByRole("button", { name: t("scan.addStamp") }).click();
  await expect(staff.getByText(t("scan.rewardEarned"))).toBeVisible();
  await dismissResult();

  await customer.reload();
  await expect(customer.getByText(t("webCard.rewardReady"))).toBeVisible();

  // A freshly filled card stays open so the reward can be handed out right away.
  await expect(staff.getByRole("heading", { name: customerName })).toBeVisible();
  await staff.getByRole("button", { name: t("scan.redeem") }).click();
  await expect(staff.getByText(t("scan.rewardRedeemed"))).toBeVisible();
  await dismissResult();

  await customer.reload();
  await expect(customer.getByText(t("webCard.rewardReady"))).toHaveCount(0);
});

test("an unknown card code is refused", async () => {
  await staff.locator("#manual-code").fill("NoSuchCard000000");
  await staff.getByRole("button", { name: t("scan.manualSubmit") }).click();
  await expect(staff.getByText(t("stamp.status.not_found"))).toBeVisible();
});

test("owner sends a broadcast and it shows on the customer's card", async () => {
  await owner.goto("/dashboard/messages");
  await owner.locator("#text").fill(broadcast);
  await owner.getByRole("button", { name: t("messages.send") }).click();
  await expect(owner.getByText(t("messages.sent", { count: 1 }))).toBeVisible();

  await customer.reload();
  await expect(customer.getByText(broadcast)).toBeVisible();
});

test("owner dashboard shows the customer, the analytics and the poster", async () => {
  await owner.goto("/dashboard");
  await expect(owner.getByText(t("overview.cardsIssued"))).toBeVisible();

  await owner.goto("/dashboard/clients");
  await expect(owner.getByText(customerName).first()).toBeVisible();

  await owner.goto("/dashboard/analytics");
  await expect(owner.getByRole("heading", { name: t("analytics.title"), level: 1 })).toBeVisible();
  await expect(owner.getByText(t("analytics.lockedTitle"))).toHaveCount(0);

  await owner.goto("/dashboard/poster");
  await expect(owner.getByText(t("poster.headline"))).toBeVisible();
  await expect(owner.getByRole("img", { name: t("poster.qrLabel") })).toBeVisible();
});

test("owner replaces the logo in settings", async () => {
  await owner.goto("/dashboard/settings");
  await owner.getByRole("button", { name: t("settings.logoRemove") }).click();
  await expect(owner.getByText(t("settings.logoRemoved"))).toBeVisible();

  await owner.locator("#logo").setInputFiles(LOGO_PNG);
  await owner.locator('button[type="submit"]', { hasText: t("settings.logoUpload") }).click();
  await expect(owner.getByText(t("settings.logoSaved"))).toBeVisible();
});
