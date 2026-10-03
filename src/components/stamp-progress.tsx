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
   * Play the "stamp lands" animation for collected stamps from this index on
   * (staggered). Omit for a still card.
   */
  animateFrom?: number;
  /** Delay before the first animated stamp, ms. */
  animationDelay?: number;
  className?: string;
}

const SIZES = {
  sm: "size-5",
  md: "size-8",
  lg: "size-10",
} as const;

const STAGGER_MS = 260;

const ANGLES = [-9, 6, -3, 11, -7, 4, -12, 8, -5, 10, -2, 7, -10, 3, -6, 9, -4, 12, -8, 5] as const;

/**
 * Hand-stamped look: every impression sits at its own small angle, like a
 * rubber stamp pressed by a person. Deterministic, so server and client agree.
 */
export function stampAngle(index: number): number {
  return ANGLES.at(index % ANGLES.length) ?? 0;
}

/**
 * One ink impression: a double ring with a star, in `currentColor`, so it
 * works on a business-colored card and on the plain UI alike.
 */
export function StampMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={className} style={style}>
      <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="0.9" opacity="0.7" />
      <path
        d="M16 8.6l2.05 4.6 5 .5-3.75 3.35 1.07 4.92L16 19.45l-4.37 2.52 1.07-4.92-3.75-3.35 5-.5z"
        fill="currentColor"
      />
    </svg>
  );
}

/** "N of M" ink stamps; empty places are dashed rings. */
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
          return (
            <span
              key={i}
              aria-hidden
              className={cn("inline-block shrink-0 rounded-full border-[1.5px] border-dashed border-current opacity-35", SIZES[size])}
            />
          );
        }
        const animated = animateFrom !== undefined && i >= animateFrom;
        // The wrapper plays the landing; the mark inside keeps its own tilt.
        return (
          <span
            key={i}
            aria-hidden
            className={cn("inline-block shrink-0", SIZES[size], animated && "stamp-land")}
            style={animated ? { animationDelay: `${animationDelay + (i - animateFrom) * STAGGER_MS}ms` } : undefined}
          >
            <StampMark className="size-full opacity-95" style={{ transform: `rotate(${stampAngle(i)}deg)` }} />
          </span>
        );
      })}
    </div>
  );
}
