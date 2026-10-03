"use client";

import { useEffect, useState } from "react";

import { CardPreview, type CardPreviewProps } from "@/components/card-preview";
import { cn } from "@/lib/utils";

const FIRST_STAMP_MS = 700;
const STAMP_EVERY_MS = 650;
const FULL_HOLD_MS = 2200;
const EMPTY_HOLD_MS = 600;

/**
 * Landing hero: the sample card fills up stamp by stamp, glows when the
 * reward is earned, empties and starts again — what the customer's card does
 * over a few visits, in a few seconds. Still (one stamp short of the reward)
 * when the visitor asked for reduced motion.
 */
export function StampingCard({
  stampsRequired,
  className,
  ...card
}: Omit<CardPreviewProps, "stampsCount" | "animateStampsFrom" | "animationDelay">) {
  const [count, setCount] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time switch to the still card
      setStill(true);
      return;
    }
    let current = 0;
    let timer: number;
    const step = () => {
      if (current < stampsRequired) {
        current += 1;
        setCount(current);
        timer = window.setTimeout(step, current === stampsRequired ? FULL_HOLD_MS : STAMP_EVERY_MS);
      } else {
        current = 0;
        setCount(0);
        timer = window.setTimeout(step, EMPTY_HOLD_MS);
      }
    };
    timer = window.setTimeout(step, FIRST_STAMP_MS);
    return () => window.clearTimeout(timer);
  }, [stampsRequired]);

  const full = !still && count === stampsRequired;

  return (
    <CardPreview
      {...card}
      // The class comes back on every full card, which restarts the glow.
      className={cn(className, full && "reward-glow")}
      stampsRequired={stampsRequired}
      stampsCount={still ? stampsRequired - 1 : count}
      // Only the newest stamp lands; the earlier ones are already on the card.
      animateStampsFrom={still || count === 0 ? undefined : count - 1}
    />
  );
}
