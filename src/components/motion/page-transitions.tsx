"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  cover,
  createLayer,
  nextTransitionType,
  prefersReducedMotion,
  reveal,
  type TransitionType,
} from "@/lib/motion/transitions";

/** Links that must stay plain browser navigations (files, API, auth callbacks). */
function isPlainLink(anchor: HTMLAnchorElement, href: string): boolean {
  return (
    anchor.hasAttribute("download") ||
    anchor.hasAttribute("data-no-transition") ||
    (anchor.target !== "" && anchor.target !== "_self") ||
    /^[a-z][a-z0-9+.-]*:/i.test(href) ||
    href.startsWith("#") ||
    href.startsWith("/api/") ||
    href.startsWith("/auth/") ||
    href.includes("/export")
  );
}

interface Pending {
  layer: HTMLDivElement;
  type: TransitionType;
  from: string;
}

/**
 * Plays a ticket-themed transition between pages: the current page is
 * covered from the tap point, the route changes underneath, and the new page
 * is revealed once it has rendered (the cover doubles as a loading screen).
 */
export function PageTransitions({ stampCaption }: { stampCaption: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const pending = useRef<Pending | null>(null);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href || isPlainLink(anchor, href) || anchor.getAttribute("aria-disabled") === "true") return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      if (prefersReducedMotion() || pending.current) return;

      // Take over from <Link>: cover first, then navigate.
      event.preventDefault();
      event.stopPropagation();
      let x = event.clientX;
      let y = event.clientY;
      if (!event.detail) {
        const rect = anchor.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }
      window.__tkNavigated = true;
      const type = nextTransitionType();
      const layer = createLayer(false);
      pending.current = { layer, type, from: window.location.pathname };
      const target = url.pathname + url.search + url.hash;
      router.prefetch(target);
      void cover(type, layer, x, y, stampCaption).then(() => router.push(target));
      // Never leave the screen covered if the route never commits.
      window.setTimeout(() => {
        if (pending.current?.layer === layer) {
          layer.remove();
          pending.current = null;
        }
      }, 9000);
    }
    const onPop = () => {
      window.__tkNavigated = true;
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, [router, stampCaption]);

  useEffect(() => {
    const current = pending.current;
    if (!current || current.from === pathname) return;
    pending.current = null;
    // The new page is on screen under the cover: swap in a fresh layer and reveal.
    const layer = createLayer(current.type === "flood");
    current.layer.remove();
    window.scrollTo(0, 0);
    document.documentElement.classList.add("pt-arrived");
    void reveal(current.type, layer, stampCaption).then(() => layer.remove());
    window.setTimeout(() => {
      layer.remove();
      document.documentElement.classList.remove("pt-arrived");
    }, 2200);
  }, [pathname, stampCaption]);

  return null;
}
