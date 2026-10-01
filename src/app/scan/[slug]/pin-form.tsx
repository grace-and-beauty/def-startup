"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";

import type { PinState } from "./types";

const ERROR_KEYS = {
  pinFormat: "scan.pinFormat",
  pinInvalid: "scan.pinInvalid",
  locked: "scan.locked",
  notConfigured: "scan.notConfigured",
  notFound: "join.notFound",
  unknown: "common.error",
} as const;

interface PinFormProps {
  action: (state: PinState, formData: FormData) => Promise<PinState>;
}

export function PinForm({ action }: PinFormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <Label htmlFor="pin">{t("scan.pin")}</Label>
        <Input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          minLength={4}
          maxLength={6}
          required
          autoFocus
          aria-invalid={state.status === "error"}
          aria-describedby={state.status === "error" ? "pin-error" : undefined}
          className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
        />
      </div>
      {state.status === "error" ? (
        <p id="pin-error" role="alert" className="text-destructive text-sm">
          {t(ERROR_KEYS[state.reason])}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-12 text-base" disabled={pending}>
        {pending ? t("scan.pinChecking") : t("scan.pinSubmit")}
      </Button>
    </form>
  );
}
