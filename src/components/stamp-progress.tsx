import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface StampProgressProps {
  /** Stamps collected on the current round. */
  count: number;
  /** Stamps needed for a reward (2–20). */
  total: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: "size-5",
  md: "size-7",
  lg: "size-9",
} as const;

/**
 * "N of M" circles. Colors follow `currentColor`, so the component works on a
 * business-colored card and on the neutral UI alike.
 */
export function StampProgress({ count, total, size = "md", className }: StampProgressProps) {
  const safeTotal = Math.max(1, Math.floor(total));
  const filled = Math.min(Math.max(0, Math.floor(count)), safeTotal);
  const label = t("card.stampsLabel", { count: filled, total: safeTotal });

  return (
    <div role="img" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {Array.from({ length: safeTotal }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "inline-block shrink-0 rounded-full border-2 border-current",
            SIZES[size],
            i < filled ? "bg-current" : "opacity-40",
          )}
        />
      ))}
    </div>
  );
}
