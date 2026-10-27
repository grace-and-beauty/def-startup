import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardPreview } from "@/components/card-preview";
import { PoweredBy } from "@/components/powered-by";
import { MessageScreen, ServiceUnavailable } from "@/components/message-screen";
import { t } from "@/lib/i18n";
import { isAcceptingCustomers, loadPublicBusiness } from "@/lib/public/loaders";
import { isGoogleWalletConfigured } from "@/lib/wallet";

import { joinProgram } from "./actions";
import { JoinForm } from "./join-form";

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const loaded = await loadPublicBusiness((await params).slug);
  return loaded.status === "ok"
    ? { title: `${loaded.data.business.name} — ${t("join.title")}` }
    : { title: t("join.title") };
}

export default async function JoinPage({ params }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const loaded = await loadPublicBusiness(slug);
  if (loaded.status === "unavailable") return <ServiceUnavailable />;
  if (loaded.status === "not_found") notFound();

  const { business, program } = loaded.data;
  // Canceled / inactive business or plan customer limit reached (architecture §5.1, §6.2).
  if (!(await isAcceptingCustomers(business, new Date()))) {
    return (
      <MessageScreen
        title={t("join.programUnavailableTitle")}
        text={t("join.programUnavailableText")}
        showHomeLink={false}
      />
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold tracking-tight">{t("join.title")}</h1>
        <p className="text-muted-foreground">{t("join.intro")}</p>
      </header>

      <CardPreview
        businessName={business.name}
        logoUrl={business.logo_url}
        bgColor={business.bg_color}
        fgColor={business.fg_color}
        labelColor={business.label_color}
        rewardText={program.reward_text}
        stampsRequired={program.stamps_required}
        stampsCount={0}
      />
      {program.terms_text ? (
        <p className="text-muted-foreground text-sm">
          {t("join.terms", { terms: program.terms_text })}
        </p>
      ) : null}

      <JoinForm
        slug={business.slug}
        action={joinProgram.bind(null, business.slug)}
        googleWalletEnabled={isGoogleWalletConfigured()}
      />

      <PoweredBy nicheSlug={business.niche_slug} source="join" />
    </main>
  );
}
