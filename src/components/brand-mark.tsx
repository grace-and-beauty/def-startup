import { StampMark } from "@/components/stamp-progress";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** Wordmark: the checked stamp + the product name in the display face. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display inline-flex items-center gap-2 text-lg font-semibold", className)}>
      <StampMark className="text-primary size-6" />
      {brand.name}
    </span>
  );
}
