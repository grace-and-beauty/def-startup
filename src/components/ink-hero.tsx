import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The big dark rounded block at the top of a landing page: copy on the left,
 * a phone on the right that sits on the block's bottom edge.
 */
export function InkHero({ children, visual, className }: { children: ReactNode; visual?: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "bg-ink text-ink-foreground grid overflow-hidden rounded-[2rem] px-6 pt-10 sm:px-10 md:grid-cols-[1fr_minmax(0,19rem)] md:gap-12 md:pt-14",
        className,
      )}
    >
      <div className="flex flex-col gap-6 pb-10 md:pb-14">{children}</div>
      {visual ? <div className="flex items-end justify-center">{visual}</div> : null}
    </section>
  );
}
