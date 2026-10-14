import { expect, test } from "@playwright/test";

import { t } from "./support";

/** Dictionary text without the "*accent*" markers, as it reads on the page. */
const plain = (text: string) => text.replaceAll("*", "");

test("home page tells the story and lists the niches", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: t("story.cue") })).toBeVisible();
  await expect(page.getByRole("heading", { name: plain(t("story.whoTitle")) })).toBeVisible();
  await expect(page.getByRole("link", { name: t("story.finalCta") })).toBeVisible();
});

test("the card builder on the home page carries the card to sign-in", async ({ page }) => {
  await page.goto("/");
  const builder = page.locator("#konstruktor");
  await builder.getByRole("radio", { name: "Інше", exact: true }).click();
  await builder.getByLabel(t("onboarding.nicheLabel")).fill("Кальянна");
  await builder.getByLabel(t("builder.reward")).fill("Кальян у подарунок");
  await builder.getByRole("button", { name: t("builder.more") }).click();
  await expect(builder.getByRole("heading", { name: "Кальянна" })).toBeVisible();
  await expect(builder.getByText("Кальян у подарунок", { exact: true })).toBeVisible();

  await builder.getByRole("link", { name: t("builder.cta") }).click();
  await expect(page).toHaveURL(/\/login\?/);
  const draft = await page.locator('input[name="draft"]').first().inputValue();
  expect(Object.fromEntries(new URLSearchParams(draft))).toEqual({
    niche: "inshe",
    stamps: "7",
    reward: "Кальян у подарунок",
    label: "Кальянна",
  });
});

test("pricing lists the three plans", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: plain(t("pricing.heroTitle")), level: 1 })).toBeVisible();
  for (const plan of ["plans.basic.name", "plans.plus.name", "plans.pro.name"] as const) {
    await expect(page.getByText(t(plan), { exact: true }).first()).toBeVisible();
  }
});

test("a niche landing page opens from the home page", async ({ page }) => {
  await page.goto("/");
  await page.locator('a[href^="/dlya/"]').first().click();
  await expect(page).toHaveURL(/\/dlya\//);
  await expect(page.getByRole("link", { name: t("niche.cta") })).toBeVisible();
});

test("login page asks for an email", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: t("login.title") })).toBeVisible();
  await expect(page.getByRole("button", { name: t("login.submit") })).toBeVisible();
});

test("signed-out visitors are sent from the dashboard to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("an unknown business shows not found", async ({ page }) => {
  const response = await page.goto("/c/no-such-business-e2e");
  expect(response?.status()).toBe(404);
});

test("legal pages open from the footer in both languages", async ({ page }) => {
  await page.goto("/pricing");
  const legalNav = page.getByRole("navigation", { name: t("footer.legalLabel") });
  for (const [key, title] of [
    ["footer.terms", "Умови використання"],
    ["footer.privacy", "Політика конфіденційності"],
    ["footer.refund", "Політика повернення коштів"],
  ] as const) {
    await legalNav.getByRole("link", { name: t(key) }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
    await expect(page.getByText("Paddle").first()).toBeVisible();
  }

  await page.getByRole("link", { name: "English version" }).click();
  await expect(page).toHaveURL(/\/en\/legal\/refund$/);
  await expect(page.getByRole("heading", { name: "Refund Policy", level: 1 })).toBeVisible();

  const response = await page.goto("/legal/no-such-doc");
  expect(response?.status()).toBe(404);
});
