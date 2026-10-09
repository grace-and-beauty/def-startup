import { Gift } from "lucide-react";
import type { CSSProperties } from "react";

import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface StampProgressProps {
  /** Stamps collected on the current round. */
  count: number;
  /** Stamps needed for a reward (2–20). */
  total: number;
  size?: "sm" | "md" | "lg";
  /**
   * Play the "stamp fills in" animation for collected stamps from this index
   * on (staggered). Omit for a still card.
   */
  animateFrom?: number;
  /** Delay before the first animated stamp, ms. */
  animationDelay?: number;
  className?: string;
}

const SIZES = {
  sm: "size-5 rounded-[0.3rem]",
  md: "size-8 rounded-[0.5rem]",
  lg: "size-10 rounded-[0.6rem]",
} as const;

const STAGGER_MS = 220;
/** The check starts drawing once its square has mostly filled in. */
const CHECK_AFTER_MS = 180;

/**
 * The product mark and the scanner's confirmation: a rounded square with a
 * check, in `currentColor`.
 */
export function StampMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} style={style}>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="currentColor" />
      <path
        d="M9.5 16.5l4.5 4.5 8.5-9.5"
        fill="none"
        stroke="var(--stamp-check, #fff)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * "N of M" stamps as squares: a collected stamp is a filled square with a
 * check; an empty place is an outlined square; the last place shows the gift.
 * The check takes `--stamp-check` (the card's background on a business card).
 */
export function StampProgress({
  count,
  total,
  size = "md",
  animateFrom,
  animationDelay = 0,
  className,
}: StampProgressProps) {
  const safeTotal = Math.max(1, Math.floor(total));
  const filled = Math.min(Math.max(0, Math.floor(count)), safeTotal);
  const label = t("card.stampsLabel", { count: filled, total: safeTotal });

  return (
    <div role="img" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {Array.from({ length: safeTotal }, (_, i) => {
        if (i >= filled) {
          const isReward = i === safeTotal - 1;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                "inline-flex shrink-0 items-center justify-center border-[1.5px] border-current",
                isReward ? "opacity-70" : "opacity-30",
                SIZES[size],
              )}
            >
              {isReward ? <Gift className="size-[55%]" strokeWidth={1.75} /> : null}
            </span>
          );
        }
        const animated = animateFrom !== undefined && i >= animateFrom;
        const delay = animationDelay + (animated ? (i - animateFrom) * STAGGER_MS : 0);
        return (
          <span
            key={i}
            aria-hidden
            className={cn("inline-block shrink-0 bg-current", SIZES[size], animated && "stamp-fill")}
            style={animated ? { animationDelay: `${delay}ms` } : undefined}
          >
            <svg viewBox="0 0 32 32" className="size-full">
              <path
                d="M9.5 16.5l4.5 4.5 8.5-9.5"
                pathLength={1}
                fill="none"
                stroke="var(--stamp-check, #fff)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={animated ? "check-draw" : undefined}
                style={animated ? { animationDelay: `${delay + CHECK_AFTER_MS}ms` } : undefined}
              />
            </svg>
          </span>
        );
      })}
    </div>
  );
}
