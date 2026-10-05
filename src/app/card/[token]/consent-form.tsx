"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

import { updateConsent, type ConsentState } from "./actions";

/** On / off switch for messages from the business, on the customer's own card. */
export function ConsentForm({ token, granted }: { token: string; granted: boolean }) {
  const [state, formAction, pending] = useActionState<ConsentState, FormData>(updateConsent.bind(null, token), {
    status: "idle",
  });
  const current = state.status === "ok" ? state.granted : granted;

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-medium">{t("webCard.consentLabel")}</h2>
        <p className="text-muted-foreground text-sm">{current ? t("webCard.consentOn") : t("webCard.consentOff")}</p>
      </div>
      <input type="hidden" name="granted" value={current ? "false" : "true"} />
      <Button type="submit" variant={current ? "outline" : "secondary"} size="sm" className="w-fit" disabled={pending}>
        {current ? t("webCard.consentDisable") : t("webCard.consentEnable")}
      </Button>
      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {t("webCard.consentError")}
        </p>
      ) : null}
    </form>
  );
}
