/**
 * Design check of the owner dashboard (dev only): creates a throwaway owner
 * with an onboarded business, screenshots the given dashboard pages in
 * WebKit at phone and desktop sizes, then deletes the owner (the business
 * goes with it).
 *
 *   npx tsx scripts/design-preview.ts <out-dir> /dashboard /dashboard/clients …
 *
 * Needs the dev server on :3001 and .env.local (Supabase URL + keys).
 */
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { webkit } from "playwright";

import { hashPin } from "../src/lib/security/pin";

const [out = "design-preview", ...paths] = process.argv.slice(2);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const email = `design-${randomUUID().slice(0, 8)}@example.com`;
  const password = randomUUID();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createError || !created.user)
    throw new Error(`createUser: ${createError?.message}`);
  const ownerId = created.user.id;

  try {
    const owner = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
    const { error: signInError } = await owner.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw new Error(`signIn: ${signInError.message}`);
    const { error: onboardError } = process.env.SKIP_ONBOARD
      ? { error: null }
      : await owner.rpc("onboard_business", {
          p_name: "Barber «Лезо»",
          p_slug: `lezo-${randomUUID().slice(0, 6)}`,
          p_niche_slug: "barbershop",
          p_bg_color: "#2c1236",
          p_fg_color: "#ffffff",
          p_label_color: "#d2b8dc",
          p_stamps_required: 8,
          p_reward_text: "8-ма стрижка безкоштовно",
          p_terms_text: "Один штамп за одну стрижку.",
          p_reminder_days: 30,
          p_reminder_text: "Давно не бачились! Чекаємо на вас.",
          p_staff_name: "Загальний",
          p_staff_pin_hash: await hashPin("482913"),
          p_contact_phone: "+380671234567",
          p_city: "Рівне",
        });
    if (onboardError) throw new Error(`onboard: ${onboardError.message}`);

    const browser = await webkit.launch();
    for (const vp of [
      { name: "m", width: 390, height: 844, mobile: true },
      { name: "d", width: 1440, height: 900, mobile: false },
    ]) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile,
        hasTouch: vp.mobile,
        baseURL: "http://localhost:3001",
      });
      const page = await context.newPage();
      const problems: string[] = [];
      page.on("pageerror", (e) => problems.push(String(e)));
      const { data: link, error: linkError } =
        await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (linkError || !link.properties)
        throw new Error(`generateLink: ${linkError?.message}`);
      const query = new URLSearchParams({
        token_hash: link.properties.hashed_token,
        type: "magiclink",
        next: "/dashboard",
      });
      await page.goto(`/auth/callback?${query}`, { waitUntil: "networkidle" });
      for (const path of paths) {
        await page.goto(path, { waitUntil: "networkidle" });
        await page.waitForTimeout(1800);
        await page.screenshot({
          path: `${out}/${vp.name}${path.replace(/\W+/g, "_")}.png`,
          fullPage: true,
        });
        const sideways = await page.evaluate(
          () =>
            document.scrollingElement!.scrollWidth -
            document.documentElement.clientWidth,
        );
        if (sideways > 1)
          problems.push(`${path}: page scrolls sideways by ${sideways}px`);
      }
      console.log(vp.name, problems.length ? problems.join(" | ") : "ok");
      await context.close();
    }
    await browser.close();
  } finally {
    await admin.auth.admin.deleteUser(ownerId);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
