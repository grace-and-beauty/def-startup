"use client";

import Link from "next/link";
import { useActionState, useEffect, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

import type { JoinState } from "./actions";

const ERROR_KEYS = {
  invalidName: "join.invalidName",
  invalidPhone: "join.invalidPhone",
  notFound: "join.notFound",
  unavailable: "unavailable.title",
  programUnavailable: "join.programUnavailableTitle",
  rateLimited: "join.rateLimited",
  unknown: "common.error",
} as const;

const TOKEN_PATTERN = /^[0-9A-Za-z]{16,64}$/;

function storageKey(slug: string) {
  return `loyalty:card:${slug}`;
}

function readStoredToken(slug: string): string | null {
  try {
    const value = window.localStorage.getItem(storageKey(slug));
    return value && TOKEN_PATTERN.test(value) ? value : null;
  } catch {
    return null;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

interface JoinFormProps {
  slug: string;
  action: (state: JoinState, formData: FormData) => Promise<JoinState>;
  googleWalletEnabled: boolean;
}

export function JoinForm({ slug, action, googleWalletEnabled }: JoinFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  // A card created earlier on this device (the token is stored only locally).
  const storedToken = useSyncExternalStore(
    subscribeStorage,
    () => readStoredToken(slug),
    () => null,
  );

  useEffect(() => {
    if (state.status !== "ok") return;
    try {
      window.localStorage.setItem(storageKey(slug), state.token);
    } catch {
      // Private mode / storage disabled: the card link still works.
    }
  }, [slug, state]);

  if (state.status === "ok") {
    return (
      <section role="status" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-bold tracking-tight">{t("join.successTitle")}</h2>
          <p className="text-muted-foreground">{t("join.successText")}</p>
        </div>
        <WalletButtons token={state.token} googleWalletEnabled={googleWalletEnabled} />
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {storedToken ? (
        <div className="bg-muted flex flex-col gap-3 rounded-lg p-4">
          <p className="text-sm">{t("join.existingCard")}</p>
          <Button asChild variant="outline">
            <Link href={`/card/${storedToken}`}>{t("join.openExisting")}</Link>
          </Button>
        </div>
      ) : null}

      <form action={formAction} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("join.name")}</Label>
          <Input
            id="name"
            name="name"
            autoComplete="given-name"
            maxLength={80}
            placeholder={t("join.namePlaceholder")}
            aria-invalid={state.status === "error" && state.reason === "invalidName"}
            className="h-11 text-base"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">{t("join.phone")}</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={24}
            placeholder={t("join.phonePlaceholder")}
            aria-invalid={state.status === "error" && state.reason === "invalidPhone"}
            className="h-11 text-base"
          />
        </div>
        {state.status === "error" ? (
          <p role="alert" className="text-destructive text-sm">
            {t(ERROR_KEYS[state.reason])}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
          {pending ? t("join.submitting") : t("join.submit")}
        </Button>
        <p className="text-muted-foreground text-xs">{t("join.privacy")}</p>
      </form>
    </div>
  );
}

function WalletButtons({ token, googleWalletEnabled }: { token: string; googleWalletEnabled: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {googleWalletEnabled ? (
        <Button asChild size="lg" className="h-12 text-base">
          {/* Route handler redirects to pay.google.com — a full navigation, not a client transition. */}
          <a href={`/api/wallet/google/${token}`}>{t("join.addToGoogleWallet")}</a>
        </Button>
      ) : null}
      <Button
        asChild
        size="lg"
        variant={googleWalletEnabled ? "outline" : "default"}
        className="h-12 text-base"
      >
        <Link href={`/card/${token}`}>{t("join.openWebCard")}</Link>
      </Button>
    </div>
  );
}
