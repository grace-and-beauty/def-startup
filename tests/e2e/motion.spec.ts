import { expect, test } from "@playwright/test";

import { t } from "./support";

// The rest of the suite runs with reduced motion; here the animations are on.
test.use({ reducedMotion: "no-preference" });

test("a page transition covers, navigates and uncovers", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: t("nav.pricing") }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.locator(".pt-layer")).toHaveCount(0, { timeout: 5000 });
  await expect(page.getByRole("link", { name: t("nav.login") })).toBeVisible();
});

test("the home intro opens the page and the cue starts the story", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".hs-intro")).toBeHidden({ timeout: 6000 });
  await page.getByRole("button", { name: t("story.cue") }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});
