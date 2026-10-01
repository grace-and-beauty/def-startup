import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ServiceUnavailable } from "@/components/message-screen";
import { readStaffSession } from "@/lib/auth/staff-cookie";
import { listStaff } from "@/lib/data";
import { usableStaff } from "@/lib/domain/plans";
import { t } from "@/lib/i18n";
import { loadPublicBusiness } from "@/lib/public/loaders";
import { tryCreateSupabaseAdminClient } from "@/lib/supabase/admin";

import { staffLogin, staffLogout } from "./actions";
import { PinForm } from "./pin-form";
import { Scanner } from "./scanner";

export const metadata: Metadata = {
  title: t("scan.title"),
  robots: { index: false, follow: false },
};

export default async function ScanPage({ params }: PageProps<"/scan/[slug]">) {
  const { slug } = await params;
  const loaded = await loadPublicBusiness(slug);
  if (loaded.status === "unavailable") return <ServiceUnavailable />;
  if (loaded.status === "not_found") notFound();
  const { business } = loaded.data;

  const session = await readStaffSession();
  const admin = tryCreateSupabaseAdminClient();
  // The session counts only while the PIN is active and allowed by the plan.
  const staff =
    session && admin && session.businessId === business.id
      ? (usableStaff(await listStaff(admin, business.id), business, new Date()).find(
          (member) => member.id === session.staffId,
        ) ?? null)
      : null;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      {staff ? (
        <Scanner
          businessName={business.name}
          staffName={staff.name}
          logoutAction={staffLogout.bind(null, business.slug)}
        />
      ) : (
        <section className="flex flex-col gap-6 pt-6">
          <div className="flex flex-col gap-1 text-center">
            <p className="text-muted-foreground text-sm">{business.name}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{t("scan.pinTitle")}</h1>
            <p className="text-muted-foreground">{t("scan.pinSubtitle")}</p>
          </div>
          <PinForm action={staffLogin.bind(null, business.slug)} />
        </section>
      )}
    </main>
  );
}
