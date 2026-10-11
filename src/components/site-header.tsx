import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { legalPath } from "@/config/legal";
import { t } from "@/lib/i18n";

export function SiteHeader() {
  return (
    <header>
      <nav
        aria-label={t("nav.mainLabel")}
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3"
      >
        <Link href="/" className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/pricing">{t("nav.pricing")}</Link>
          </Button>
          <Button asChild size="sm" className="bg-ink text-ink-foreground hover:bg-ink/85">
            <Link href="/login">{t("nav.login")}</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t">
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <span>
            © {brand.name}
          </span>
          <span>{t("footer.support", { email: brand.supportEmail })}</span>
        </div>
        <nav aria-label={t("footer.legalLabel")} className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href={legalPath("terms")} className="hover:text-foreground underline-offset-4 hover:underline">
            {t("footer.terms")}
          </Link>
          <Link href={legalPath("privacy")} className="hover:text-foreground underline-offset-4 hover:underline">
            {t("footer.privacy")}
          </Link>
          <Link href={legalPath("refund")} className="hover:text-foreground underline-offset-4 hover:underline">
            {t("footer.refund")}
          </Link>
          <Link
            href={legalPath("terms", "en")}
            hrefLang="en"
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            {t("footer.english")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
