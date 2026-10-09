import type { Metadata } from "next";
import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/admin";
import { t } from "@/lib/i18n";

import { signOut } from "../dashboard/actions";

/** Service admin: never indexed, never cached, never linked from the site. */
export const metadata: Metadata = {
  title: t("admin.title"),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { user } = await requireAdmin();
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-12">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <BrandMark />
          </Link>
          <span className="bg-card rounded-full border px-3 py-1 text-xs">{t("admin.title")}</span>
        </div>
        <form action={signOut} className="flex items-center gap-3">
          <span className="text-muted-foreground hidden text-sm sm:inline">{user.email}</span>
          <Button type="submit" size="sm" className="bg-ink text-ink-foreground hover:bg-ink/85">
            {t("dashboard.logout")}
          </Button>
        </form>
      </header>
      {children}
    </div>
  );
}
