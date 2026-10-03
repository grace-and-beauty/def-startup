import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { brand } from "@/config/brand";
import { t } from "@/lib/i18n";

export function SiteHeader() {
  return (
    <header className="border-b">
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
          <Button asChild variant="outline" size="sm">
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
      <div className="text-muted-foreground mx-auto flex w-full max-w-5xl flex-col gap-1 px-4 py-6 text-sm">
        <span>
          © {brand.name}
        </span>
        <span>{t("footer.support", { email: brand.supportEmail })}</span>
      </div>
    </footer>
  );
}
