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
  /** Stamps land one by one from this index (landing page hero). */
  animateStampsFrom?: number;
  animationDelay?: number;
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
  animateStampsFrom,
  animationDelay,
  children,
  className,
}: CardPreviewProps) {
  return (
    <article
      className={cn("flex w-full flex-col gap-5 rounded-[1.375rem] p-5 shadow-[0_1px_0_rgb(255_255_255/0.08)_inset,0_18px_40px_-24px_rgb(26_24_56/0.55)]", className)}
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
            className="font-display flex size-11 shrink-0 items-center justify-center rounded-full border border-current text-base font-bold opacity-80"
          >
            {businessName.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <h2 className="font-display min-w-0 flex-1 truncate text-base leading-tight font-bold tracking-tight">
          {businessName}
        </h2>
      </header>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm" style={{ color: labelColor }}>
            {t("card.stampsLabel", {
              count: Math.min(stampsCount, stampsRequired),
              total: stampsRequired,
            })}
          </span>
        </div>
        <StampProgress
          count={stampsCount}
          total={stampsRequired}
          animateFrom={animateStampsFrom}
          animationDelay={animationDelay}
        />
      </section>

      <section className="flex flex-col gap-1">
        <span className="text-sm" style={{ color: labelColor }}>
          {t("card.rewardLabel")}
        </span>
        <p className="text-base font-medium">{rewardText}</p>
      </section>

      {customerName ? (
        <section className="flex flex-col gap-1">
          <span className="text-sm" style={{ color: labelColor }}>
            {t("card.customerLabel")}
          </span>
          <p className="text-base">{customerName}</p>
        </section>
      ) : null}

      {children}
    </article>
  );
}
