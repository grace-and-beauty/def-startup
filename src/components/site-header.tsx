import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { brand } from "@/config/brand";
import { legalPath } from "@/config/legal";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Header of the public pages, on the dark stage. `overlay` floats it over a full-bleed hero. */
export function SiteHeader({
  overlay = false,
  current,
  className,
}: {
  overlay?: boolean;
  current?: "pricing";
  className?: string;
}) {
  return (
    <header className={cn("z-30 w-full", overlay ? "fixed inset-x-0 top-0" : "relative", className)}>
      <nav
        aria-label={t("nav.mainLabel")}
        className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3 px-4 pt-[calc(14px+env(safe-area-inset-top))] pb-3.5 [--mark-hole:var(--ink)] sm:px-8"
      >
        <Link
          href="/"
          className="text-ink-foreground focus-visible:ring-brand rounded-lg outline-none focus-visible:ring-[3px]"
        >
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/pricing"
            aria-current={current === "pricing" ? "page" : undefined}
            className="text-ink-foreground focus-visible:ring-brand rounded-xl px-3.5 py-2.5 text-sm font-bold underline-offset-[6px] outline-none hover:underline focus-visible:ring-[3px] aria-[current=page]:underline"
          >
            {t("nav.pricing")}
          </Link>
          <Link
            href="/login"
            className="bg-ink-foreground text-ink focus-visible:ring-brand rounded-xl px-4 py-2.5 text-sm font-bold outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-[3px]"
          >
            {t("nav.login")}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter({ className }: { className?: string }) {
  const link = "text-ink-muted hover:text-ink-foreground underline underline-offset-4";
  return (
    <footer className={cn("border-ink-line mx-auto mt-auto w-full max-w-[1400px] border-t px-4 sm:px-8", className)}>
      <div className="text-ink-muted flex flex-col gap-3 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {brand.name} · {t("footer.support", { email: brand.supportEmail })}
        </span>
        <nav aria-label={t("footer.legalLabel")} className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href={legalPath("terms")} className={link}>
            {t("footer.terms")}
          </Link>
          <Link href={legalPath("privacy")} className={link}>
            {t("footer.privacy")}
          </Link>
          <Link href={legalPath("refund")} className={link}>
            {t("footer.refund")}
          </Link>
          <Link href={legalPath("terms", "en")} hrefLang="en" className={link}>
            {t("footer.english")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
