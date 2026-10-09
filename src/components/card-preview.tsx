import type { CSSProperties, ReactNode } from "react";

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
  /** Stamps fill in one by one from this index (landing page hero). */
  animateStampsFrom?: number;
  animationDelay?: number;
  /** The white strip at the bottom of the card (e.g. the QR code). */
  children?: ReactNode;
  className?: string;
}

/**
 * The business' loyalty card as the customer sees it (web card, join page,
 * landing examples, onboarding live preview), wallet-pass style: the
 * business' colors on top, a big stamp count, an optional white strip with
 * the code at the bottom. Colors are the business' own (validated hex values
 * from the database / niche config).
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
  const shown = Math.min(stampsCount, stampsRequired);
  return (
    <article
      className={cn(
        "flex w-full flex-col overflow-hidden rounded-[1.5rem] shadow-[0_24px_48px_-28px_rgb(20_20_20/0.55)]",
        className,
      )}
      // The check on a stamp is cut out in the card's own background color.
      style={{ backgroundColor: bgColor, color: fgColor, "--stamp-check": bgColor } as CSSProperties}
    >
      <div className="flex flex-col gap-5 p-5">
        <header className="flex items-center gap-3">
          {logoUrl ? (
            // Owner-uploaded logo from Supabase Storage; next/image would need remotePatterns per project.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-10 shrink-0 rounded-full bg-white/10 object-cover" />
          ) : (
            <span
              aria-hidden
              className="font-display flex size-10 shrink-0 items-center justify-center rounded-full border border-current text-base font-bold opacity-80"
            >
              {businessName.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <h2 className="font-display min-w-0 flex-1 truncate text-lg leading-tight font-semibold">{businessName}</h2>
        </header>

        <section className="flex flex-col gap-3">
          <div className="flex items-end justify-between gap-2">
            <span className="text-sm" style={{ color: labelColor }}>
              {t("card.stampsTitle")}
            </span>
            <span className="font-display leading-none lining-nums tabular-nums" aria-hidden>
              <span className="text-[2.6rem] font-bold">{shown}</span>
              <span className="text-xl font-semibold opacity-70"> / {stampsRequired}</span>
            </span>
          </div>
          <StampProgress
            count={stampsCount}
            total={stampsRequired}
            animateFrom={animateStampsFrom}
            animationDelay={animationDelay}
          />
        </section>

        <div className="flex flex-wrap gap-x-8 gap-y-4">
          <section className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs tracking-wide uppercase" style={{ color: labelColor }}>
              {t("card.rewardLabel")}
            </span>
            <p className="text-base font-medium">{rewardText}</p>
          </section>

          {customerName ? (
            <section className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs tracking-wide uppercase" style={{ color: labelColor }}>
                {t("card.customerLabel")}
              </span>
              <p className="text-base">{customerName}</p>
            </section>
          ) : null}
        </div>
      </div>

      {children ? <div className="bg-white px-5 py-4 text-[#141414]">{children}</div> : null}
    </article>
  );
}
