"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

import { sendMagicLink, type LoginState } from "./actions";

const ERROR_KEYS = {
  invalidEmail: "login.invalidEmail",
  notConfigured: "login.notConfigured",
  rateLimited: "login.rateLimited",
  unknown: "common.error",
} as const;

export function LoginForm({ niche }: { niche?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, {
    status: "idle",
  });

  if (state.status === "sent") {
    return (
      <div role="status" className="bg-muted flex flex-col gap-2 rounded-lg p-4">
        <p className="font-medium">{t("login.sentTitle")}</p>
        <p className="text-muted-foreground text-sm">{t("login.sent", { email: state.email })}</p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {niche ? <input type="hidden" name="niche" value={niche} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          placeholder={t("login.emailPlaceholder")}
          aria-invalid={state.status === "error" && state.reason === "invalidEmail"}
          aria-describedby={state.status === "error" ? "login-error" : undefined}
          className="h-11 text-base"
        />
      </div>
      {state.status === "error" ? (
        <p id="login-error" role="alert" className="text-destructive text-sm">
          {t(ERROR_KEYS[state.reason])}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? t("login.sending") : t("login.submit")}
      </Button>
    </form>
  );
}
