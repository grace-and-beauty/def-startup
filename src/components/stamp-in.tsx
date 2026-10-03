"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Stamps its content in (the same press as a card stamp) the first time it
 * scrolls into view. Visible from the start for reduced motion / no JS.
 */
export function StampIn({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [state, setState] = useState<"idle" | "waiting" | "stamped">("idle");

  useEffect(() => {
    const node = ref.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setState("waiting");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setState("stamped");
          observer.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      ref={ref}
      className={cn("inline-block", state === "waiting" && "opacity-0", state === "stamped" && "stamp-land", className)}
      style={state === "stamped" ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </span>
  );
}
