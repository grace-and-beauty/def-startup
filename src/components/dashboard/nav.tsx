"use client";

import {
  BarChart3,
  CreditCard,
  Home,
  LogOut,
  Megaphone,
  MoreHorizontal,
  Printer,
  Settings,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { t, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: TranslationKey;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar (the rest goes under «Ще»). */
  primary?: boolean;
}

const NAV: readonly NavItem[] = [
  { href: "/dashboard", label: "dashboard.nav.home", icon: Home, primary: true },
  { href: "/dashboard/analytics", label: "dashboard.nav.analytics", icon: BarChart3, primary: true },
  { href: "/dashboard/clients", label: "dashboard.nav.clients", icon: Users, primary: true },
  { href: "/dashboard/messages", label: "dashboard.nav.messages", icon: Megaphone, primary: true },
  { href: "/dashboard/staff", label: "dashboard.nav.staff", icon: UserCog },
  { href: "/dashboard/poster", label: "dashboard.nav.poster", icon: Printer },
  { href: "/dashboard/settings", label: "dashboard.nav.settings", icon: Settings },
  { href: "/dashboard/billing", label: "dashboard.nav.billing", icon: CreditCard },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

interface DashboardNavProps {
  logoutAction: () => Promise<void>;
}

/** Desktop: left sidebar. Hidden on mobile (see MobileNav). */
export function SidebarNav({ logoutAction }: DashboardNavProps) {
  const pathname = usePathname();
  return (
    <nav aria-label={t("dashboard.menuLabel")} className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors",
              active ? "bg-ink-2 text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-brand")} aria-hidden />
            {t(item.label)}
          </Link>
        );
      })}
      <form action={logoutAction} className="mt-4 border-t pt-4">
        <button
          type="submit"
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition-colors"
        >
          <LogOut className="size-4 shrink-0" aria-hidden />
          {t("dashboard.logout")}
        </button>
      </form>
    </nav>
  );
}

/** Mobile: fixed bottom bar with the main sections + «Ще» sheet. */
export function MobileNav({ logoutAction }: DashboardNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV.filter((item) => item.primary);
  const secondary = NAV.filter((item) => !item.primary);
  const secondaryActive = secondary.some((item) => isActive(pathname, item.href));

  const tabClass = (active: boolean) =>
    cn(
      "flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[11px] leading-tight",
      active ? "text-brand font-bold" : "text-muted-foreground",
    );

  return (
    <nav
      aria-label={t("dashboard.menuLabel")}
      className="theme-stage bg-ink text-foreground fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
    >
      <ul className="flex">
        {primary.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={tabClass(active)}
              >
                <Icon className="size-5" aria-hidden />
                <span className="w-full truncate text-center">{t(item.label)}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className={tabClass(secondaryActive)}>
              <MoreHorizontal className="size-5" aria-hidden />
              <span className="w-full truncate text-center">{t("dashboard.more")}</span>
            </DialogTrigger>
            <DialogContent className="top-auto bottom-0 max-w-full translate-y-0 rounded-b-none">
              <DialogTitle>{t("dashboard.more")}</DialogTitle>
              <DialogDescription className="sr-only">{t("dashboard.menuLabel")}</DialogDescription>
              <ul className="flex flex-col gap-1">
                {secondary.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "hover:bg-muted flex items-center gap-3 rounded-md px-3 py-3",
                          active && "bg-muted font-medium",
                        )}
                      >
                        <Icon className="size-5 shrink-0" aria-hidden />
                        {t(item.label)}
                      </Link>
                    </li>
                  );
                })}
                <li className="mt-2 border-t pt-2">
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="text-muted-foreground hover:bg-muted flex w-full items-center gap-3 rounded-md px-3 py-3"
                    >
                      <LogOut className="size-5 shrink-0" aria-hidden />
                      {t("dashboard.logout")}
                    </button>
                  </form>
                </li>
              </ul>
            </DialogContent>
          </Dialog>
        </li>
      </ul>
    </nav>
  );
}
