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

/** A perforation line across the card with the two notches punched out of its edges. */
function Perforation({ color }: { color: string }) {
  return (
    <div aria-hidden className="relative -mx-5 my-1 border-t-2 border-dashed" style={{ borderColor: color }}>
      <span className="absolute -top-3 -left-3 size-6 rounded-full bg-[var(--hole-fill,var(--background))]" />
      <span className="absolute -top-3 -right-3 size-6 rounded-full bg-[var(--hole-fill,var(--background))]" />
    </div>
  );
}

/**
 * The business' loyalty card as the customer sees it (web card, join page,
 * landing examples, onboarding live preview) — a ticket: the business'
 * colors, a perforation, stamps punched through as holes, and an optional
 * white stub at the bottom (e.g. the QR code). Holes and notches show
 * `--hole-fill`, the page behind the card. Colors are the business' own
 * (validated hex values from the database / niche config).
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
  const line = `color-mix(in srgb, ${fgColor} 35%, transparent)`;
  return (
    <article
      className={cn("flex w-full flex-col rounded-[1.4rem] shadow-[0_26px_50px_-30px_rgb(20_10_30/0.65)]", className)}
      style={{ backgroundColor: bgColor, color: fgColor, "--stamp-check": bgColor } as CSSProperties}
    >
      <div className="flex flex-col gap-4 p-5">
        <header className="flex items-center gap-3">
          {logoUrl ? (
            // Owner-uploaded logo from Supabase Storage; next/image would need remotePatterns per project.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-11 shrink-0 rounded-xl bg-white/10 object-cover" />
          ) : (
            <span
              aria-hidden
              className="font-display flex size-11 shrink-0 items-center justify-center rounded-xl border-2 border-current text-lg opacity-80"
            >
              {businessName.trim().charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="font-display truncate text-[1.35rem] leading-tight">{businessName}</h2>
            <p className="line-clamp-2 text-sm" style={{ color: labelColor }}>
              {rewardText}
            </p>
          </div>
        </header>

        <Perforation color={line} />

        <StampProgress
          count={stampsCount}
          total={stampsRequired}
          animateFrom={animateStampsFrom}
          animationDelay={animationDelay}
        />

        <div className="flex items-end justify-between gap-3">
          <span className="font-display leading-none lining-nums tabular-nums" aria-hidden>
            <span className="text-[2.4rem]">{shown}</span>
            <span className="text-lg opacity-70"> / {stampsRequired}</span>
          </span>
          <span className="flex min-w-0 flex-col items-end text-right text-sm">
            <span className="text-xs tracking-wide uppercase" style={{ color: labelColor }}>
              {customerName ? t("card.customerLabel") : t("card.stampsTitle")}
            </span>
            {customerName ? <span className="max-w-full truncate font-semibold">{customerName}</span> : null}
          </span>
        </div>
        <p className="sr-only">
          {t("card.rewardLabel")}: {rewardText}
        </p>
      </div>

      {children ? (
        <div className="relative rounded-b-[1.4rem] bg-white px-5 pt-5 pb-4 text-[#2c1236]">
          <div aria-hidden className="absolute inset-x-0 -top-px border-t-2 border-dashed border-[#2c1236]/20">
            <span className="absolute -top-3 -left-3 size-6 rounded-full bg-[var(--hole-fill,var(--background))]" />
            <span className="absolute -top-3 -right-3 size-6 rounded-full bg-[var(--hole-fill,var(--background))]" />
          </div>
          {children}
        </div>
      ) : null}
    </article>
  );
}
