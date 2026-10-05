import type { Metadata } from "next";

import { PageHeader, Section } from "@/components/dashboard/blocks";
import { Badge } from "@/components/ui/badge";
import { requireOwnerContext } from "@/lib/auth/owner";
import { countMessagesSince, listMessages } from "@/lib/data";
import { getLimit, hasFeature, remaining } from "@/lib/domain/plans";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { isGoogleWalletConfigured } from "@/lib/wallet";

import { sendBroadcast } from "./actions";
import { BroadcastForm } from "./broadcast-form";
import { countRecipients, monthStart } from "./recipients";

export const metadata: Metadata = { title: t("messages.title") };

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const { supabase, business } = await requireOwnerContext();
  const now = new Date();
  const atRiskAllowed = hasFeature(business, "analytics", now);
  const initialTarget = (await searchParams).target === "at_risk" ? "at_risk" : "all";

  const [history, used, recipients] = await Promise.all([
    listMessages(supabase, business.id, 50),
    countMessagesSince(supabase, business.id, "broadcast", monthStart(now, business.timezone)),
    countRecipients(supabase, business.id, now),
  ]);
  const limit = getLimit(business, "broadcastsPerMonth", now);
  const left = remaining(limit, used);

  return (
    <>
      <PageHeader
        title={t("messages.title")}
        description={
          <>
            {t("messages.intro")} {t("messages.consentNote")}
          </>
        }
      />

      <Section
        title={t("messages.send")}
        hint={
          <>
            {Number.isFinite(limit)
              ? left > 0
                ? t("messages.quota", { left, limit })
                : t("messages.quotaExhausted")
              : t("messages.quotaUnlimited")}
            {isGoogleWalletConfigured() ? null : (
              <>
                <br />
                {t("messages.walletNote")}
              </>
            )}
          </>
        }
      >
        <BroadcastForm
          action={sendBroadcast}
          recipients={recipients}
          atRiskAllowed={atRiskAllowed}
          quotaLeft={left}
          initialTarget={initialTarget}
        />
      </Section>

      <Section title={t("messages.historyTitle")}>
        {history.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("messages.historyEmpty")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {history.map((message) => (
              <li key={message.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant={message.kind === "broadcast" ? "default" : "secondary"}>
                    {t(`messages.kind.${message.kind}`)}
                  </Badge>
                  <span className="text-muted-foreground">
                    {formatDateTime(message.created_at, business.timezone)} ·{" "}
                    {t(`messages.targetLabel.${message.target}`)} ·{" "}
                    {t("messages.recipients", { count: message.recipients_count })}
                  </span>
                </div>
                <p className="text-sm">{message.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
