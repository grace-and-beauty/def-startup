import { expect, test } from "@playwright/test";

import { adminClient, createOwner, deleteOwner, signIn, supabaseConfigured, t, type TestOwner } from "./support";

/**
 * /admin answers 404 to everyone but the emails in ADMIN_EMAILS (set for the
 * E2E server in playwright.config.ts), so the page does not reveal itself.
 */
const ADMIN_EMAIL = "e2e-admin@example.com";

test("signed-out visitors get a plain 404", async ({ page }) => {
  const response = await page.goto("/admin");
  expect(response?.status()).toBe(404);
});

test.describe("signed in", () => {
  test.skip(!supabaseConfigured(), "needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");

  let owner: TestOwner | undefined;
  let admin: TestOwner | undefined;

  test.afterAll(async () => {
    const client = adminClient();
    await deleteOwner(client, owner);
    await deleteOwner(client, admin);
  });

  test("an owner who is not an admin gets 404 too", async ({ page }) => {
    const client = adminClient();
    owner = await createOwner(client);
    await signIn(page, client, owner, "/dashboard");
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });

  test("the admin sees the overview and the businesses", async ({ page }) => {
    const client = adminClient();
    const { data, error } = await client.auth.admin.createUser({ email: ADMIN_EMAIL, email_confirm: true });
    if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
    admin = { id: data.user.id, email: ADMIN_EMAIL };

    await signIn(page, client, admin, "/admin");
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: t("admin.heroTitle"), level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: t("admin.tableTitle") })).toBeVisible();
  });
});
