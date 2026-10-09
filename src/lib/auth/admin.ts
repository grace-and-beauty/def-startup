import "server-only";

import { notFound } from "next/navigation";

import { isAdminEmail } from "@/lib/env";

import { getOwnerSession, type OwnerSession } from "./owner";

/**
 * Service admin pages (/admin): a signed-in user whose email is in
 * ADMIN_EMAILS. Everyone else — signed out or not on the list — gets a plain
 * 404, so the page does not reveal that it exists. The admin signs in on
 * /login like an owner and lands here (src/app/login/actions.ts).
 *
 * Data on these pages is read with the service role, so every page must call
 * this first.
 */
export async function requireAdmin(): Promise<OwnerSession> {
  const session = await getOwnerSession();
  if (!session || !isAdminEmail(session.user.email)) notFound();
  return session;
}
