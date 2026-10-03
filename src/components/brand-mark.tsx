import { StampMark } from "@/components/stamp-progress";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Wordmark: the ink stamp + the product name in the display face. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display inline-flex items-center gap-2 text-[0.95rem] font-bold tracking-tight", className)}>
      <StampMark className="text-primary size-6 -rotate-12" />
      {brand.name}
    </span>
  );
}
