import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export { t } from "../../src/lib/i18n";

/**
 * The journey specs need a real Supabase project (the one in .env.local) and
 * the service role key: they create a throwaway owner, then delete it — which
 * cascades to the business and everything under it.
 */
export function supabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function adminClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface TestOwner {
  id: string;
  email: string;
}

export async function createOwner(admin: SupabaseClient): Promise<TestOwner> {
  const email = `e2e-${randomUUID().slice(0, 8)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  return { id: data.user.id, email };
}

export async function deleteOwner(admin: SupabaseClient, owner: TestOwner | undefined): Promise<void> {
  if (!owner) return;
  const { error } = await admin.auth.admin.deleteUser(owner.id);
  if (error) throw new Error(`deleteUser failed: ${error.message}`);
}

/** Signs the owner in the way the magic link does, minus the inbox: token_hash → /auth/callback. */
export async function signIn(page: Page, admin: SupabaseClient, owner: TestOwner, next: string): Promise<void> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: owner.email });
  if (error || !data.properties) throw new Error(`generateLink failed: ${error?.message}`);
  const query = new URLSearchParams({ token_hash: data.properties.hashed_token, type: "magiclink", next });
  await page.goto(`/auth/callback?${query}`);
}

/** A valid 8×8 PNG (red square) for the logo upload. */
export const LOGO_PNG = {
  name: "logo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC",
    "base64",
  ),
};
