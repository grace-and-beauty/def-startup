import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";

import { BillingBanner } from "@/components/dashboard/billing-banner";
import { ContactsBanner } from "@/components/dashboard/contacts-banner";
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
      <aside className="theme-stage bg-ink text-foreground hidden w-64 shrink-0 flex-col gap-7 p-4 md:sticky md:top-0 md:flex md:h-svh print:hidden">
        <div className="flex flex-col gap-1 px-3 pt-2">
          <Link href="/dashboard" className="w-fit">
            <BrandMark />
          </Link>
          <span className="text-muted-foreground truncate pl-[42px] text-sm">{business.name}</span>
        </div>
        <SidebarNav logoutAction={signOut} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-x-clip">
        <header className="theme-stage bg-ink text-foreground flex items-center justify-between gap-3 px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-3 md:hidden print:hidden">
          <Link href="/dashboard">
            <BrandMark />
          </Link>
          <span className="text-muted-foreground truncate text-sm">{business.name}</span>
        </header>
        <main className="pt-rise mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-28 md:px-8 md:pt-8 md:pb-12 print:max-w-none print:p-0">
          <BillingBanner business={business} now={now} />
          <ContactsBanner business={business} />
          {children}
        </main>
      </div>

      <MobileNav logoutAction={signOut} />
    </div>
  );
}
