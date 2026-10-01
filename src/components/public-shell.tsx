import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";

/** Layout of the marketing pages (/, /dlya/[niche], /pricing, /login). */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-10 sm:py-14">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
