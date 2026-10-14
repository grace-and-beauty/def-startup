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
        // The screen is always light paper (also on the dark stage), so punched holes read as holes.
        "relative w-full max-w-[19rem] border-[7px] border-[#1b1c22] bg-[#f6f2f8] px-3 pt-9 pb-4 [--hole-fill:#f6f2f8] shadow-[0_0_120px_-30px_rgb(var(--glow)/0.55)]",
        cropped ? "rounded-t-[2.6rem] border-b-0" : "rounded-[2.6rem]",
        className,
      )}
    >
      <span className="absolute top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-[#0b0c0e]" />
      {children}
    </div>
  );
}

/** A decorative barcode for sample cards (the real card shows a QR). */
export function SampleBarcode() {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="h-10 w-full max-w-48 bg-[repeating-linear-gradient(90deg,#2c1236_0_2px,transparent_2px_4px,#2c1236_4px_5px,transparent_5px_8px,#2c1236_8px_11px,transparent_11px_12px)]" />
      <span className="font-mono text-[0.65rem] tracking-[0.2em] text-[#6a5873]">3278 4537 6547</span>
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
