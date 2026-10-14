"use client";

import { useActionState, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { sendLoginCode, verifyLoginCode, type LoginState, type VerifyState } from "./actions";

const SEND_ERROR_KEYS = {
  invalidEmail: "login.invalidEmail",
  notConfigured: "login.notConfigured",
  rateLimited: "login.rateLimited",
  unknown: "common.error",
} as const;

const VERIFY_ERROR_KEYS = {
  invalidCode: "login.invalidCode",
  notConfigured: "login.notConfigured",
  rateLimited: "login.codeRateLimited",
  unknown: "common.error",
} as const;

/* Dark-stage controls. */
const FIELD =
  "border-ink-line bg-ink-2 text-ink-foreground placeholder:text-ink-muted/60 focus-visible:border-brand focus-visible:ring-brand/40 h-14 rounded-2xl px-4 text-lg md:text-lg";
const PRIMARY =
  "bg-brand text-brand-foreground hover:bg-brand/90 h-14 rounded-2xl text-base font-extrabold transition-transform hover:-translate-y-0.5";
const ERROR = "text-sm font-semibold text-[#ffb4a8]";

/** Supabase lets one email get a new code once a minute; the button waits as long. */
const RESEND_AFTER_MS = 60_000;

/** Owner sign-in in two steps: email → one-time code from the letter. */
export function LoginForm({ draft }: { draft?: string }) {
  const [sendState, sendAction, sending] = useActionState<LoginState, FormData>(sendLoginCode, {
    status: "idle",
  });
  // "Change email" brings the first step back without losing the sent state.
  const [changingEmail, setChangingEmail] = useState(false);

  if (sendState.status === "sent" && !changingEmail) {
    return (
      <CodeStep
        email={sendState.email}
        sentAt={sendState.sentAt}
        draft={draft}
        onChangeEmail={() => setChangingEmail(true)}
      />
    );
  }

  return (
    <form action={sendAction} onSubmit={() => setChangingEmail(false)} className="flex flex-col gap-3.5" noValidate>
      {draft ? <input type="hidden" name="draft" value={draft} /> : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email" className="text-ink-muted font-bold">
          {t("login.email")}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          defaultValue={sendState.status === "sent" ? sendState.email : undefined}
          placeholder={t("login.emailPlaceholder")}
          aria-invalid={sendState.status === "error" && sendState.reason === "invalidEmail"}
          aria-describedby={sendState.status === "error" ? "login-error" : undefined}
          className={FIELD}
        />
      </div>
      {sendState.status === "error" ? (
        <p id="login-error" role="alert" className={ERROR}>
          {t(SEND_ERROR_KEYS[sendState.reason])}
        </p>
      ) : null}
      <Button type="submit" size="lg" className={PRIMARY} disabled={sending}>
        {sending ? t("login.sending") : t("login.submit")}
      </Button>
    </form>
  );
}

function CodeStep({
  email,
  sentAt,
  draft,
  onChangeEmail,
}: {
  email: string;
  sentAt: number;
  draft?: string;
  onChangeEmail: () => void;
}) {
  const [verifyState, verifyAction, verifying] = useActionState<VerifyState, FormData>(verifyLoginCode, {
    status: "idle",
  });
  const [resendState, resendAction, resending] = useActionState<LoginState, FormData>(sendLoginCode, {
    status: "idle",
  });
  const lastSentAt = resendState.status === "sent" ? resendState.sentAt : sentAt;
  const secondsLeft = useSecondsUntil(lastSentAt + RESEND_AFTER_MS);

  return (
    <div className="flex flex-col gap-5">
      <div role="status" className="flex flex-col gap-1">
        <p className="font-display text-xl">{t("login.sentTitle")}</p>
        <p className="text-ink-muted">{t("login.sent", { email })}</p>
      </div>

      <form action={verifyAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        {draft ? <input type="hidden" name="draft" value={draft} /> : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="code" className="text-ink-muted font-bold">
            {t("login.code")}
          </Label>
          <Input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={12}
            required
            autoFocus
            aria-invalid={verifyState.status === "error"}
            aria-describedby={verifyState.status === "error" ? "code-error" : undefined}
            className={cn(FIELD, "font-display h-16 text-center text-3xl tracking-[0.35em]")}
          />
        </div>
        {verifyState.status === "error" ? (
          <p id="code-error" role="alert" className={ERROR}>
            {t(VERIFY_ERROR_KEYS[verifyState.reason])}
          </p>
        ) : null}
        <Button type="submit" size="lg" className={PRIMARY} disabled={verifying}>
          {verifying ? t("login.verifying") : t("login.codeSubmit")}
        </Button>
      </form>

      <div className="flex flex-col items-start gap-1 text-sm">
        <form action={resendAction}>
          <input type="hidden" name="email" value={email} />
          {draft ? <input type="hidden" name="draft" value={draft} /> : null}
          <Button type="submit" variant="link" className="text-ink-foreground h-auto px-0" disabled={resending || secondsLeft > 0}>
            {secondsLeft > 0 ? t("login.resendIn", { seconds: secondsLeft }) : t("login.resend")}
          </Button>
        </form>
        {resendState.status === "sent" ? (
          <p role="status" className="text-ink-muted">
            {t("login.resent")}
          </p>
        ) : null}
        {resendState.status === "error" ? (
          <p role="alert" className={ERROR}>
            {t(SEND_ERROR_KEYS[resendState.reason])}
          </p>
        ) : null}
        <Button type="button" variant="link" className="text-ink-muted h-auto px-0" onClick={onChangeEmail}>
          {t("login.changeEmail")}
        </Button>
      </div>
    </div>
  );
}

/** Whole seconds until `deadline` (ms), ticking down to 0. */
function useSecondsUntil(deadline: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
