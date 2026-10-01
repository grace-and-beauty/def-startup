import type { Metadata } from "next";

import { PageHeader } from "@/components/dashboard/blocks";
import { QrCode } from "@/components/qr-code";
import { requireOwnerContext } from "@/lib/auth/owner";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";

import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: t("poster.title") };

/** A5 poster for the counter: QR to /c/[slug]. Printed via the browser (@media print). */
export default async function PosterPage() {
  const { business, program } = await requireOwnerContext();
  const joinUrl = `${siteUrl()}/c/${business.slug}`;
  const displayUrl = joinUrl.replace(/^https?:\/\//, "");

  return (
    <>
      {/* A5 portrait, no browser margins: the poster box below is exactly one page. */}
      <style>{"@page { size: A5 portrait; margin: 0; }"}</style>

      <PageHeader title={t("poster.title")} description={t("poster.intro")} actions={<PrintButton />} />
      <p className="text-muted-foreground -mt-3 text-xs print:hidden">{t("poster.tip")}</p>

      <article
        className="mx-auto flex aspect-[148/210] w-full max-w-[148mm] flex-col overflow-hidden rounded-lg border bg-white text-black shadow-sm print:aspect-auto print:h-[210mm] print:w-[148mm] print:max-w-none print:rounded-none print:border-0 print:shadow-none"
        style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      >
        <header
          className="flex items-center gap-[4%] px-[8%] py-[6%]"
          style={{ backgroundColor: business.bg_color, color: business.fg_color }}
        >
          {business.logo_url ? (
            // Owner-uploaded logo from Supabase Storage.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={business.logo_url} alt="" className="size-14 shrink-0 rounded-full object-cover print:size-[20mm]" />
          ) : null}
          <h2 className="text-[clamp(1.25rem,5vw,2rem)] leading-tight font-semibold">{business.name}</h2>
        </header>

        <div className="flex flex-1 flex-col items-center justify-between gap-[3%] px-[8%] py-[6%] text-center">
          <div className="flex flex-col gap-2">
            <p className="text-[clamp(1rem,3.6vw,1.4rem)] font-medium">{t("poster.headline")}</p>
            <p className="text-[clamp(1.5rem,6vw,2.4rem)] leading-tight font-bold">{program.reward_text}</p>
            <p className="text-[clamp(0.8rem,2.6vw,1rem)] text-neutral-600">
              {t("poster.stampsNeeded", { count: program.stamps_required })}
            </p>
          </div>

          <div className="w-[58%]">
            <QrCode value={joinUrl} label={t("poster.qrLabel")} />
          </div>

          <ol className="flex flex-col gap-1 text-left text-[clamp(0.75rem,2.4vw,0.95rem)]">
            {[t("poster.step1"), t("poster.step2"), t("poster.step3")].map((step, i) => (
              <li key={step} className="flex gap-2">
                <span className="font-semibold">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <p className="font-mono text-[clamp(0.65rem,2vw,0.8rem)] break-all text-neutral-600">{displayUrl}</p>
        </div>
      </article>
    </>
  );
}
