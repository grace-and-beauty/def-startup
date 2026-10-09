import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

import { BillingBanner } from "@/components/dashboard/billing-banner";
import { MobileNav, SidebarNav } from "@/components/dashboard/nav";
import { requireOwnerContext } from "@/lib/auth/owner";

import { signOut } from "../actions";

/**
 * Dashboard shell: sidebar on desktop, bottom bar on mobile. Requires a
 * finished onboarding (otherwise → /dashboard/onboarding).
 */
export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { business } = await requireOwnerContext();
  const now = new Date();

  return (
    <div className="flex flex-1">
      <aside className="bg-card hidden w-60 shrink-0 flex-col gap-6 border-r p-4 md:flex print:hidden">
        <div className="flex flex-col gap-0.5 px-3">
          <Link href="/dashboard" className="w-fit">
            <BrandMark />
          </Link>
          <span className="text-muted-foreground truncate pl-8 text-sm">{business.name}</span>
        </div>
        <SidebarNav logoutAction={signOut} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b px-4 py-3 md:hidden print:hidden">
          <Link href="/dashboard">
            <BrandMark />
          </Link>
          <span className="text-muted-foreground truncate text-sm">{business.name}</span>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-6 pb-28 md:pb-10 print:max-w-none print:p-0">
          <BillingBanner business={business} now={now} />
          {children}
        </main>
      </div>

      <MobileNav logoutAction={signOut} />
    </div>
  );
}
