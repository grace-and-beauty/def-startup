import { expect, test } from "@playwright/test";

import { adminClient, supabaseConfigured, t } from "./support";

/**
 * Owner sign-in with a one-time email code. The first step really sends a
 * letter, and Supabase's built-in mailer only delivers to the project team's
 * addresses — so the full flow runs only with E2E_LOGIN_EMAIL set to such an
 * address (it gets one letter per run). The code itself is taken from the
 * admin API, the way the inbox would show it.
 */
const LOGIN_EMAIL = process.env.E2E_LOGIN_EMAIL;

test("an invalid email is refused before anything is sent", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel(t("login.email")).fill("not-an-email");
  await page.getByRole("button", { name: t("login.submit") }).click();
  await expect(page.getByText(t("login.invalidEmail"))).toBeVisible();
});

test("owner signs in with the code from the letter; a wrong code is refused", async ({ page }) => {
  test.skip(!supabaseConfigured() || !LOGIN_EMAIL, "needs Supabase keys and E2E_LOGIN_EMAIL (a team address)");
  const admin = adminClient();

  await page.goto("/login");
  await page.getByLabel(t("login.email")).fill(LOGIN_EMAIL!);
  await page.getByRole("button", { name: t("login.submit") }).click();
  await expect(page.getByText(t("login.sentTitle"))).toBeVisible();

  await page.getByLabel(t("login.code")).fill("00000000");
  await page.getByRole("button", { name: t("login.codeSubmit") }).click();
  await expect(page.getByText(t("login.invalidCode"))).toBeVisible();

  // A fresh code replaces the one in the letter.
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: LOGIN_EMAIL! });
  if (error || !data.properties) throw new Error(`generateLink failed: ${error?.message}`);
  await page.getByLabel(t("login.code")).fill(data.properties.email_otp);
  await page.getByRole("button", { name: t("login.codeSubmit") }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});
