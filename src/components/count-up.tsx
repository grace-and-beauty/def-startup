"use client";

import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/motion/transitions";

/**
 * A formatted number ("1 248", "71%") that counts up from zero once on
 * mount. The final text is rendered on the server, so it reads correctly
 * without JavaScript and for screen readers.
 */
export function CountUp({ text, duration = 1200 }: { text: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    const match = /^(\D*)([\d\s  ]+)(.*)$/.exec(text);
    if (!el || !match || prefersReducedMotion()) return;
    const [, prefix = "", digits = "", suffix = ""] = match;
    const target = Number(digits.replace(/\D/g, ""));
    if (!Number.isFinite(target) || target === 0) return;
    const format = new Intl.NumberFormat("uk-UA");
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = `${prefix}${format.format(Math.round(target * eased))}${suffix}`;
      if (p < 1) frame = requestAnimationFrame(tick);
      else el.textContent = text;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [text, duration]);
  return <span ref={ref}>{text}</span>;
}
