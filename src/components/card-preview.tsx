import type { ReactNode } from "react";

import { StampProgress } from "@/components/stamp-progress";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface CardPreviewProps {
  businessName: string;
  logoUrl?: string | null;
  bgColor: string;
  fgColor: string;
  labelColor: string;
  rewardText: string;
  stampsRequired: number;
  stampsCount: number;
  customerName?: string | null;
  /** Extra content at the bottom of the card (e.g. the QR code). */
  children?: ReactNode;
  className?: string;
}

/**
 * The business' loyalty card as the customer sees it (web card, join page,
 * landing examples, onboarding live preview). Colors are the business'
 * own (validated hex values from the database / niche config).
 */
export function CardPreview({
  businessName,
  logoUrl,
  bgColor,
  fgColor,
  labelColor,
  rewardText,
  stampsRequired,
  stampsCount,
  customerName,
  children,
  className,
}: CardPreviewProps) {
  return (
    <article
      className={cn("flex w-full flex-col gap-5 rounded-2xl p-5 shadow-sm", className)}
      style={{ backgroundColor: bgColor, color: fgColor }}
    >
      <header className="flex items-center gap-3">
        {logoUrl ? (
          // Owner-uploaded logo from Supabase Storage; next/image would need remotePatterns per project.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="size-11 shrink-0 rounded-full bg-white/10 object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full border border-current text-lg font-semibold opacity-80"
          >
            {businessName.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <h2 className="min-w-0 flex-1 truncate text-lg leading-tight font-semibold">
          {businessName}
        </h2>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs tracking-wide uppercase" style={{ color: labelColor }}>
            {t("card.stampsLabel", {
              count: Math.min(stampsCount, stampsRequired),
              total: stampsRequired,
            })}
          </span>
        </div>
        <StampProgress count={stampsCount} total={stampsRequired} />
      </section>

      <section className="flex flex-col gap-1">
        <span className="text-xs tracking-wide uppercase" style={{ color: labelColor }}>
          {t("card.rewardLabel")}
        </span>
        <p className="text-base font-medium">{rewardText}</p>
      </section>

      {customerName ? (
        <section className="flex flex-col gap-1">
          <span className="text-xs tracking-wide uppercase" style={{ color: labelColor }}>
            {t("card.customerLabel")}
          </span>
          <p className="text-base">{customerName}</p>
        </section>
      ) : null}

      {children}
    </article>
  );
}
