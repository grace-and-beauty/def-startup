import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

import { adminClient, createOwner, deleteOwner, signIn, supabaseConfigured, t, type TestOwner } from "./support";

/**
 * An owner arrives from the card builder with «Інше» (stamps, reward and the
 * business name already chosen), names their own category in the wizard and
 * finishes: the business keeps everything from the builder.
 */
test.skip(!supabaseConfigured(), "needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");

let owner: TestOwner | undefined;

test.afterAll(async () => {
  await deleteOwner(adminClient(), owner);
});

test("a card from the builder with «Інше» goes through the wizard", async ({ page }) => {
  const admin = adminClient();
  owner = await createOwner(admin);
  const run = randomUUID().slice(0, 8);
  const draft = new URLSearchParams({
    niche: "inshe",
    stamps: "9",
    reward: `Кальян у подарунок ${run}`,
    name: `Дим ${run}`,
  });
  await signIn(page, admin, owner, `/dashboard/onboarding?${draft}`);

  // No category name yet: the wizard stays on the first step and asks for it.
  await expect(page.getByRole("radio", { name: /Інше/ })).toHaveAttribute("aria-checked", "true");
  const next = page.getByRole("button", { name: t("common.next") });
  await next.click();
  await expect(page.getByText(t("onboarding.nicheLabelInvalid"))).toBeVisible();
  await page.getByLabel(t("onboarding.nicheLabel")).fill("Кальянна");
  await next.click();

  await expect(page.locator("#name")).toHaveValue(`Дим ${run}`);
  await page.locator("#slug").fill(`e2e-dym-${run}`);
  await page.locator("#contactPhone").fill("067 123 45 67");
  await page.locator("#city").fill("Рівне");
  await next.click();
  await next.click();

  await expect(page.locator("#stampsRequired")).toHaveValue("9");
  await expect(page.locator("#rewardText")).toHaveValue(`Кальян у подарунок ${run}`);
  await next.click();

  await page.locator("#pin").fill("482615");
  await page.locator("#pinConfirm").fill("482615");
  await page.getByRole("button", { name: t("onboarding.finish") }).click();
  await expect(page.getByRole("heading", { name: t("onboarding.doneTitle") })).toBeVisible();

  const { data: business, error } = await admin
    .from("businesses")
    .select("id, niche_slug, programs(stamps_required, reward_text)")
    .eq("owner_id", owner.id)
    .single();
  if (error) throw new Error(error.message);
  expect(business).toMatchObject({
    niche_slug: "inshe",
    programs: { stamps_required: 9, reward_text: `Кальян у подарунок ${run}` },
  });

  // The label column comes with migration 20261014000100; until it is applied
  // the server skips the label and onboarding still succeeds (checked above).
  const label = await admin.from("businesses").select("niche_label").eq("id", business.id).single();
  if (label.error?.code === "42703" || label.error?.message.includes("niche_label")) {
    test.info().annotations.push({ type: "note", description: "niche_label migration not applied on this database" });
  } else {
    expect(label.data).toEqual({ niche_label: "Кальянна" });
  }
});
