import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

/** The ticket glyph: a stub with two punched holes, the second one in the accent. */
export function TicketGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 22" className={cn("h-[22px] w-[30px] shrink-0", className)} aria-hidden>
      <path
        fill="currentColor"
        d="M3 1h24a2 2 0 0 1 2 2v5a3 3 0 0 0 0 6v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-5a3 3 0 0 0 0-6V3a2 2 0 0 1 2-2z"
      />
      <circle cx="11" cy="11" r="2.6" className="fill-[var(--mark-hole,var(--background))]" />
      <circle cx="19" cy="11" r="2.6" className="fill-brand" />
    </svg>
  );
}

/** Wordmark: the ticket glyph + the product name in Russo One. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span className={cn("font-brand inline-flex items-center gap-2.5 text-xl", className)}>
      <TicketGlyph />
      {brand.name}
    </span>
  );
}
