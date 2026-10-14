import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";

/** Layout of the marketing pages (/dlya/[niche], /pricing, /login, /legal): the dark plum stage. */
export function PublicShell({ children, current }: { children: ReactNode; current?: "pricing" }) {
  return (
    <div className="theme-stage bg-ink text-ink-foreground flex min-h-full flex-1 flex-col overflow-x-clip">
      <SiteHeader current={current} />
      <main className="pt-rise mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-14 px-4 pt-8 pb-16 sm:px-8 sm:pt-14">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
