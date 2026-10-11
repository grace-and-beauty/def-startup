import { expect, test } from "@playwright/test";

import { t } from "./support";

test("home page shows the pitch and the niches", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: t("home.chooseNiche") })).toBeVisible();
  await expect(page.getByRole("link", { name: t("nav.start") }).first()).toBeVisible();
});

test("pricing lists the three plans", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: t("pricing.title"), level: 1 })).toBeVisible();
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
