import type { Metadata } from "next";
import { connection } from "next/server";

import { ServiceUnavailable } from "@/components/message-screen";
import { requireOwnerSession } from "@/lib/auth/owner";
import { isSupabaseConfigured } from "@/lib/env";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: t("dashboard.title"),
  robots: { index: false, follow: false },
};

/** Every /dashboard route needs a signed-in owner (pages re-check on their own). */
export default async function DashboardRootLayout({ children }: LayoutProps<"/dashboard">) {
  // Per-request only: never prerender (env and the session are runtime values).
  await connection();
  if (!isSupabaseConfigured()) return <ServiceUnavailable />;
  await requireOwnerSession();
  return <>{children}</>;
}
