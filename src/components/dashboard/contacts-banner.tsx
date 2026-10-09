import Link from "next/link";

import { Banner } from "@/components/dashboard/blocks";
import { Button } from "@/components/ui/button";
import type { Business } from "@/lib/data";
import { t } from "@/lib/i18n";

/** Businesses created before the wizard asked for them: please add phone and city. */
export function ContactsBanner({ business }: { business: Business }) {
  if (business.contact_phone && business.city) return null;
  return (
    <Banner
      action={
        <Button asChild size="sm" className="shrink-0">
          <Link href="/dashboard/settings#contacts">{t("dashboard.contactsBannerCta")}</Link>
        </Button>
      }
    >
      {t("dashboard.contactsBanner")}
    </Banner>
  );
}
