import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CardPreview } from "@/components/card-preview";
import { PoweredBy } from "@/components/powered-by";
import { ServiceUnavailable } from "@/components/message-screen";
import { QrCode } from "@/components/qr-code";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { loadPublicCard } from "@/lib/public/loaders";
import { googleWalletSavePath, isGoogleWalletConfigured } from "@/lib/wallet";

import { AddToHome } from "./add-to-home";
import { AutoRefresh } from "./auto-refresh";
import { ConsentForm } from "./consent-form";

/** The URL is the customer's credential: keep it out of search engines and Referer headers. */
export const metadata: Metadata = {
  title: t("webCard.title"),
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const JUST_STAMPED_MS = 90_000;

export default async function WebCardPage({ params, searchParams }: PageProps<"/card/[token]">) {
  const { token } = await params;
  const walletError = (await searchParams).wallet === "error";
  const loaded = await loadPublicCard(token);
  if (loaded.status === "unavailable") return <ServiceUnavailable />;
  if (loaded.status === "not_found") notFound();

  const { business, program, card, latestMessage } = loaded.data;
  const required = program.stamps_required;
  // A stamp from the last minute and a half lands again on this render, so the
  // customer at the till sees it arrive (AutoRefresh re-renders after a stamp).
  const justStamped =
    card.stamps_count > 0 &&
    card.last_visit_at !== null &&
    new Date().getTime() - new Date(card.last_visit_at).getTime() < JUST_STAMPED_MS;
  const remaining = Math.max(required - card.stamps_count, 0);
  // Saving again is harmless (same pass id), so the button stays for re-installs.
  const showGoogleWallet = isGoogleWalletConfigured();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-6">
      <AutoRefresh />

      <CardPreview
        businessName={business.name}
        logoUrl={business.logo_url}
        bgColor={business.bg_color}
        fgColor={business.fg_color}
        labelColor={business.label_color}
        rewardText={program.reward_text}
        stampsRequired={required}
        stampsCount={card.stamps_count}
        customerName={card.customer?.name}
        animateStampsFrom={justStamped ? card.stamps_count - 1 : undefined}
        animationDelay={200}
      >
        <div className="flex flex-col items-center gap-2">
          <div className="w-full max-w-52 overflow-hidden">
            <QrCode value={card.qr_token} label={t("webCard.showQr")} />
          </div>
          <p className="text-sm text-[#5f5c57]">{t("webCard.showQr")}</p>
        </div>
      </CardPreview>

      <section aria-live="polite" className="flex flex-col gap-2">
        {card.rewards_available > 0 ? (
          <div className="bg-primary text-primary-foreground rounded-2xl p-4">
            <p className="font-semibold">{t("webCard.rewardReady")}</p>
            <p className="text-sm">
              {t("webCard.rewardsAvailable", { count: card.rewards_available })}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">{t("webCard.remaining", { count: remaining })}</p>
        )}
      </section>

      {latestMessage ? (
        <section className="bg-card flex flex-col gap-1 rounded-2xl border p-4">
          <h2 className="text-muted-foreground text-sm">
            {t("webCard.messageTitle")}
          </h2>
          <p>{latestMessage.text}</p>
          <time
            dateTime={latestMessage.created_at}
            className="text-muted-foreground text-xs"
          >
            {new Intl.DateTimeFormat("uk-UA", {
              dateStyle: "medium",
              timeZone: business.timezone,
            }).format(new Date(latestMessage.created_at))}
          </time>
        </section>
      ) : null}

      {walletError ? (
        <p role="alert" className="text-destructive text-sm">
          {t("webCard.walletError")}
        </p>
      ) : null}

      {showGoogleWallet ? (
        <Button asChild size="lg" className="h-12 text-base">
          <a href={googleWalletSavePath(card.qr_token)} data-no-transition>{t("join.addToGoogleWallet")}</a>
        </Button>
      ) : null}

      <ConsentForm token={card.qr_token} granted={card.customer?.marketing_consent_at != null} />

      <AddToHome />

      <footer className="text-muted-foreground flex flex-col gap-1 text-xs">
        <p>{t("webCard.code", { code: card.qr_token })}</p>
        <p>{t("webCard.autoUpdate")}</p>
        <p>{t("webCard.privateNote")}</p>
      </footer>

      <PoweredBy nicheSlug={business.niche_slug} source="card" />
    </main>
  );
}
