"use client";

import { Smartphone } from "lucide-react";
import { useSyncExternalStore } from "react";

import { t } from "@/lib/i18n";

type Env = "ios" | "android" | "other" | "installed";

const subscribe = () => () => {};

function detectEnv(): Env {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but with touch points.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) {
    return "ios";
  }
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** Home-screen hint with steps for the visitor's phone; hidden once the card is opened from the home screen. */
export function AddToHome() {
  const env = useSyncExternalStore<Env>(subscribe, detectEnv, () => "other");
  if (env === "installed") return null;

  const text =
    env === "ios"
      ? t("webCard.homeScreenIos")
      : env === "android"
        ? t("webCard.homeScreenAndroid")
        : t("webCard.homeScreenText");

  return (
    <section className="bg-card flex gap-3 rounded-2xl border p-4">
      <Smartphone className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{t("webCard.homeScreenTitle")}</h2>
        <p className="text-muted-foreground text-sm">{text}</p>
      </div>
    </section>
  );
}
