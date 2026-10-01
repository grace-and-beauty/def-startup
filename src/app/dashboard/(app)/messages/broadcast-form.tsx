"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BROADCAST_MAX_LENGTH } from "@/lib/domain/business-input";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { BroadcastState, BroadcastTarget } from "./types";

const ERROR_KEYS = {
  textInvalid: "messages.textInvalid",
  targetInvalid: "messages.targetInvalid",
  quotaExhausted: "messages.quotaExhausted",
  noRecipients: "messages.noRecipients",
  sessionExpired: "dashboard.sessionExpired",
  unknown: "common.error",
} as const;

interface BroadcastFormProps {
  action: (state: BroadcastState, formData: FormData) => Promise<BroadcastState>;
  recipients: { all: number; atRisk: number };
  atRiskAllowed: boolean;
  quotaLeft: number;
  initialTarget: BroadcastTarget;
}

export function BroadcastForm({ action, recipients, atRiskAllowed, quotaLeft, initialTarget }: BroadcastFormProps) {
  const [state, formAction, pending] = useActionState(action, { sent: 0, status: "idle" });

  useEffect(() => {
    if (state.status === "ok") toast.success(t("messages.sent", { count: state.recipients }));
  }, [state]);

  return (
    <div className="flex flex-col gap-3">
      {/* Remount after each successful send to clear the draft. */}
      <Composer
        key={state.sent}
        formAction={formAction}
        pending={pending}
        recipients={recipients}
        atRiskAllowed={atRiskAllowed}
        disabled={quotaLeft <= 0}
        initialTarget={atRiskAllowed ? initialTarget : "all"}
      />
      {state.status === "error" ? (
        <p role="alert" className="text-destructive text-sm">
          {t(ERROR_KEYS[state.reason])}
        </p>
      ) : null}
    </div>
  );
}

function Composer({
  formAction,
  pending,
  recipients,
  atRiskAllowed,
  disabled,
  initialTarget,
}: {
  formAction: (formData: FormData) => void;
  pending: boolean;
  recipients: { all: number; atRisk: number };
  atRiskAllowed: boolean;
  disabled: boolean;
  initialTarget: BroadcastTarget;
}) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState<BroadcastTarget>(initialTarget);
  const length = text.trim().length;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="text">{t("messages.text")}</Label>
          <span
            className={cn("text-xs tabular-nums", length > BROADCAST_MAX_LENGTH ? "text-destructive" : "text-muted-foreground")}
            aria-live="polite"
          >
            {t("messages.counter", { count: text.length, max: BROADCAST_MAX_LENGTH })}
          </span>
        </div>
        <Textarea
          id="text"
          name="text"
          rows={3}
          required
          maxLength={BROADCAST_MAX_LENGTH}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("messages.textPlaceholder")}
          disabled={disabled}
          className="text-base"
        />
      </div>

      <fieldset className="flex flex-col gap-2" disabled={disabled}>
        <legend className="mb-2 text-sm font-medium">{t("messages.target")}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="target"
            value="all"
            checked={target === "all"}
            onChange={() => setTarget("all")}
            className="size-4"
          />
          {t("messages.targetAll", { count: recipients.all })}
        </label>
        <label className={cn("flex items-center gap-2 text-sm", !atRiskAllowed && "text-muted-foreground")}>
          <input
            type="radio"
            name="target"
            value="at_risk"
            checked={target === "at_risk"}
            onChange={() => setTarget("at_risk")}
            disabled={!atRiskAllowed}
            className="size-4"
          />
          {atRiskAllowed
            ? t("messages.targetAtRisk", { count: recipients.atRisk })
            : t("messages.targetAtRiskLocked")}
        </label>
      </fieldset>

      <Button type="submit" size="lg" className="self-start" disabled={disabled || pending || length === 0}>
        {pending ? t("messages.sending") : t("messages.send")}
      </Button>
    </form>
  );
}
