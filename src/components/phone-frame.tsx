import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A phone drawn in CSS around a piece of real UI (landing pages). `cropped`
 * cuts the phone off at the bottom edge of its container, the way it peeks out
 * of the hero block.
 */
export function PhoneFrame({
  children,
  cropped = false,
  className,
}: {
  children: ReactNode;
  cropped?: boolean;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "bg-background relative border-[#2c2c2e] w-full max-w-[19rem] border-[7px] px-3 pt-9 pb-4",
        cropped ? "rounded-t-[2.6rem] border-b-0" : "rounded-[2.6rem]",
        className,
      )}
    >
      <span className="bg-ink absolute top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full" />
      {children}
    </div>
  );
}

/** A decorative barcode for sample cards (the real card shows a QR). */
export function SampleBarcode() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="h-10 w-full max-w-48 bg-[repeating-linear-gradient(90deg,#141414_0_2px,transparent_2px_4px,#141414_4px_5px,transparent_5px_8px,#141414_8px_11px,transparent_11px_12px)]" />
      <span className="font-mono text-[0.65rem] tracking-[0.2em] text-[#5f5c57]">3278 4537 6547</span>
    </div>
  );
}

/** Tops of other businesses' cards peeking above the main one, wallet-style. */
export function WalletPeek({ cards }: { cards: { name: string; bg: string; fg: string }[] }) {
  return (
    <div className="flex flex-col">
      {cards.map((card) => (
        <div
          key={card.name}
          className="font-display -mb-5 h-14 rounded-t-[1.5rem] px-5 pt-3 text-sm font-semibold"
          style={{ backgroundColor: card.bg, color: card.fg }}
        >
          {card.name}
        </div>
      ))}
    </div>
  );
}
