"use client";

import type { IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, CheckCircle2, Gift, LogOut, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { StampProgress } from "@/components/stamp-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { addStamp, lookupCard, redeemCardReward } from "./actions";
import type { ScanActionResult, ScanCard, ScanFailure } from "./types";

const FAILURE_KEYS: Record<ScanFailure, TranslationKey> = {
  invalid_code: "scan.invalidCode",
  not_found: "stamp.status.not_found",
  staff_inactive: "stamp.status.staff_inactive",
  cooldown: "stamp.status.cooldown",
  no_reward: "stamp.status.no_reward",
  session_expired: "scan.sessionExpired",
  inactive: "scan.inactive",
  error: "common.error",
};

const RESULT_AUTO_CLOSE_MS = 4000;

type Screen =
  | { kind: "scan"; error?: ScanFailure }
  | { kind: "card"; card: ScanCard }
  | { kind: "result"; result: ScanActionResult; card: ScanCard };

interface ScannerProps {
  businessName: string;
  staffName: string;
  logoutAction: () => Promise<void>;
}

export function Scanner({ businessName, staffName, logoutAction }: ScannerProps) {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>({ kind: "scan" });
  const [pending, startTransition] = useTransition();

  const handleFailure = useCallback(
    (reason: ScanFailure) => {
      if (reason === "session_expired" || reason === "staff_inactive") router.refresh();
    },
    [router],
  );

  const lookup = useCallback(
    (code: string) => {
      startTransition(async () => {
        const result = await lookupCard(code);
        if (result.ok) {
          setScreen({ kind: "card", card: result.card });
        } else {
          setScreen({ kind: "scan", error: result.reason });
          handleFailure(result.reason);
        }
      });
    },
    [handleFailure],
  );

  const runCardAction = (card: ScanCard, action: typeof addStamp) => {
    startTransition(async () => {
      const result = await action(card.id);
      const updated = result.ok ? { ...result.card, customerName: card.customerName } : card;
      setScreen({ kind: "result", result, card: updated });
      if (!result.ok) handleFailure(result.reason);
    });
  };

  const closeResult = useCallback(() => {
    setScreen((current) => {
      if (current.kind !== "result") return current;
      // A freshly filled card can be redeemed right away; otherwise go to the next customer.
      if (current.result.ok && current.result.kind === "stamp" && current.card.rewardsAvailable > 0) {
        return { kind: "card", card: current.card };
      }
      return { kind: "scan" };
    });
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{businessName}</p>
          <p className="text-muted-foreground truncate text-sm">
            {t("scan.signedInAs", { name: staffName })}
          </p>
        </div>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            <LogOut aria-hidden />
            {t("scan.logout")}
          </Button>
        </form>
      </header>

      {screen.kind === "scan" ? (
        <ScanScreen error={screen.error} pending={pending} onCode={lookup} />
      ) : null}

      {screen.kind === "card" ? (
        <CardScreen
          card={screen.card}
          pending={pending}
          onStamp={() => runCardAction(screen.card, addStamp)}
          onRedeem={() => runCardAction(screen.card, redeemCardReward)}
          onCancel={() => setScreen({ kind: "scan" })}
        />
      ) : null}

      {screen.kind === "result" ? (
        <ResultOverlay result={screen.result} card={screen.card} onClose={closeResult} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ScanScreen({
  error,
  pending,
  onCode,
}: {
  error?: ScanFailure;
  pending: boolean;
  onCode: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <CameraScanner onCode={onCode} disabled={pending} />

      {error ? (
        <p role="alert" className="text-destructive text-sm font-medium">
          {t(FAILURE_KEYS[error])}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (code.trim()) onCode(code);
        }}
      >
        <Label htmlFor="manual-code">{t("scan.manualTitle")}</Label>
        <div className="flex gap-2">
          <Input
            id="manual-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={t("scan.manualPlaceholder")}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            maxLength={512}
            className="h-11 font-mono text-base"
          />
          <Button type="submit" className="h-11" disabled={pending || !code.trim()}>
            {pending ? t("scan.searching") : t("scan.manualSubmit")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CameraScanner({ onCode, disabled }: { onCode: (code: string) => void; disabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [active, setActive] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setActive(false);
  }, []);

  useEffect(() => () => controlsRef.current?.stop(), []);

  const start = async () => {
    if (!videoRef.current) return;
    setCameraError(false);
    handledRef.current = false;
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const reader = new BrowserQRCodeReader();
      setActive(true);
      controlsRef.current = await reader.decodeFromConstraints(
        { video: { facingMode: "environment" } },
        videoRef.current,
        (result) => {
          if (!result || handledRef.current) return;
          handledRef.current = true;
          stop();
          onCode(result.getText());
        },
      );
    } catch {
      setActive(false);
      setCameraError(true);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "bg-muted relative aspect-square w-full overflow-hidden rounded-xl",
          !active && "flex items-center justify-center",
        )}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          className={cn("size-full object-cover", !active && "hidden")}
        />
        {!active ? (
          <p className="text-muted-foreground px-6 text-center text-sm">{t("scan.cameraHint")}</p>
        ) : null}
      </div>
      {cameraError ? (
        <p role="alert" className="text-destructive text-sm">
          {t("scan.cameraError")}
        </p>
      ) : null}
      {active ? (
        <Button type="button" variant="outline" size="lg" className="h-12" onClick={stop}>
          <CameraOff aria-hidden />
          {t("scan.cameraStop")}
        </Button>
      ) : (
        <Button type="button" size="lg" className="h-12 text-base" onClick={start} disabled={disabled}>
          <Camera aria-hidden />
          {t("scan.cameraStart")}
        </Button>
      )}
    </div>
  );
}

function CardScreen({
  card,
  pending,
  onStamp,
  onRedeem,
  onCancel,
}: {
  card: ScanCard;
  pending: boolean;
  onStamp: () => void;
  onRedeem: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="flex flex-col gap-5 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold">{card.customerName ?? t("scan.noName")}</h2>
        <p className="text-muted-foreground text-sm">
          {t("scan.visits", { count: card.totalVisits })}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-medium">
          {t("scan.progress", { count: card.stampsCount, total: card.stampsRequired })}
        </p>
        <StampProgress count={card.stampsCount} total={card.stampsRequired} size="lg" />
      </div>
      {card.nextStampAt ? (
        <p className="text-muted-foreground text-sm">
          {t("scan.retryAfter", { time: formatTime(card.nextStampAt) })}
        </p>
      ) : null}
      {card.rewardsAvailable > 0 ? (
        <p className="bg-success text-success-foreground rounded-lg px-4 py-3 font-medium">
          {t("scan.rewardsAvailable", { count: card.rewardsAvailable })}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button size="lg" className="h-16 text-xl" disabled={pending} onClick={onStamp}>
          {pending ? t("scan.working") : t("scan.addStamp")}
        </Button>
        {card.rewardsAvailable > 0 ? (
          <Button
            size="lg"
            variant="outline"
            className="h-14 text-lg"
            disabled={pending}
            onClick={onRedeem}
          >
            <Gift aria-hidden />
            {t("scan.redeem")}
          </Button>
        ) : null}
        <Button variant="ghost" disabled={pending} onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      </div>
    </section>
  );
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );
}

function ResultOverlay({
  result,
  card,
  onClose,
}: {
  result: ScanActionResult;
  card: ScanCard;
  onClose: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onClose, RESULT_AUTO_CLOSE_MS);
    return () => window.clearTimeout(id);
  }, [onClose]);

  const Icon = result.ok ? CheckCircle2 : XCircle;
  let title: string;
  let detail: string | null = null;

  if (result.ok) {
    title = result.kind === "reward" ? t("scan.rewardRedeemed") : t("stamp.status.ok");
    detail =
      result.kind === "stamp" && result.rewardsEarned > 0
        ? t("scan.rewardEarned")
        : t("scan.progress", { count: card.stampsCount, total: card.stampsRequired });
  } else {
    title = t(FAILURE_KEYS[result.reason]);
    if (result.reason === "cooldown" && result.retryAfter) {
      detail = t("scan.retryAfter", { time: formatTime(result.retryAfter) });
    }
  }

  return (
    <button
      type="button"
      role="alert"
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 p-8 text-center",
        result.ok ? "bg-success text-success-foreground" : "bg-destructive text-white",
      )}
    >
      <Icon className="size-28" aria-hidden />
      <span className="text-3xl font-bold">{title}</span>
      {card.customerName ? <span className="text-xl">{card.customerName}</span> : null}
      {detail ? <span className="text-lg">{detail}</span> : null}
      <span className="mt-6 text-sm opacity-80">{t("scan.tapToContinue")}</span>
    </button>
  );
}
