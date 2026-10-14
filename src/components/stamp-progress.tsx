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
   * Punch the collected stamps from this index on (staggered). Omit for a
   * still card.
   */
  animateFrom?: number;
  /** Delay before the first animated stamp, ms. */
  animationDelay?: number;
  className?: string;
}

const SIZES = {
  sm: "size-5",
  md: "size-9",
  lg: "size-11",
} as const;

const STAGGER_MS = 220;

/**
 * The confirmation mark: a punched hole with a check, in `currentColor`
 * (the check takes `--stamp-check`).
 */
export function StampMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} style={style}>
      <circle cx="16" cy="16" r="14.5" fill="currentColor" />
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
 * "N of M" stamps as holes in a ticket: a collected stamp is punched through
 * (shows `--hole-fill`, the page behind the card), an empty place is a
 * ring, the last place carries the gift.
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
    <div role="img" aria-label={label} className={cn("flex flex-wrap gap-2.5", className)}>
      {Array.from({ length: safeTotal }, (_, i) => {
        if (i >= filled) {
          const isReward = i === safeTotal - 1;
          return (
            <span
              key={i}
              aria-hidden
              className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-full border-2 border-current",
                isReward ? "border-dashed opacity-80" : "opacity-35",
                SIZES[size],
              )}
            >
              {isReward ? <Gift className="size-[52%]" strokeWidth={1.9} /> : null}
            </span>
          );
        }
        const animated = animateFrom !== undefined && i >= animateFrom;
        const delay = animationDelay + (animated ? (i - animateFrom) * STAGGER_MS : 0);
        return (
          <span
            key={i}
            aria-hidden
            className={cn("hole relative inline-block shrink-0 rounded-full", SIZES[size], animated && "hole-punch")}
            style={animated ? ({ "--punch-delay": `${delay}ms` } as CSSProperties) : undefined}
          />
        );
      })}
    </div>
  );
}
