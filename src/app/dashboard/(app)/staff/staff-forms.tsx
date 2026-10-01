"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t, type TranslationKey } from "@/lib/i18n";

import { STAFF_ERROR_KEYS, type StaffActionState } from "./types";

type Action = (state: StaffActionState, formData: FormData) => Promise<StaffActionState>;

function errorText(state: StaffActionState): string | null {
  if (state.status !== "error") return null;
  return t(STAFF_ERROR_KEYS[state.reason], { limit: state.limit ?? "" });
}

/** Toast on success (sonner lives outside React state). */
function useSuccessToast(state: StaffActionState, key: TranslationKey, onSuccess?: () => void) {
  useEffect(() => {
    if (state.status !== "ok") return;
    toast.success(t(key));
    onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per result
  }, [state]);
}

function PinInput({ id, label }: { id: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name="pin"
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        pattern="[0-9]{4,6}"
        minLength={4}
        maxLength={6}
        required
        className="h-10 w-40 tracking-widest"
      />
    </div>
  );
}

export function AddStaffForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  useSuccessToast(state, "staff.added");
  const error = errorText(state);

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="staff-name">{t("staff.name")}</Label>
        <Input
          id="staff-name"
          name="name"
          required
          maxLength={60}
          placeholder={t("staff.namePlaceholder")}
          className="h-10"
        />
      </div>
      <PinInput id="staff-pin" label={t("staff.pin")} />
      <Button type="submit" className="h-10" disabled={pending}>
        {t("staff.add")}
      </Button>
      {error ? (
        <p role="alert" className="text-destructive text-sm sm:basis-full">
          {error}
        </p>
      ) : null}
    </form>
  );
}

interface StaffRowActionsProps {
  name: string;
  isActive: boolean;
  toggleAction: (state: StaffActionState) => Promise<StaffActionState>;
  pinAction: Action;
}

export function StaffRowActions({ name, isActive, toggleAction, pinAction }: StaffRowActionsProps) {
  const [toggleState, toggle, toggling] = useActionState(toggleAction, { status: "idle" });
  useSuccessToast(toggleState, "staff.updated");
  const toggleError = errorText(toggleState);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <ChangePinDialog name={name} action={pinAction} />
        <form action={toggle}>
          <Button type="submit" variant="outline" size="sm" disabled={toggling}>
            {isActive ? t("staff.deactivate") : t("staff.activate")}
          </Button>
        </form>
      </div>
      {toggleError ? (
        <p role="alert" className="text-destructive text-xs">
          {toggleError}
        </p>
      ) : null}
    </div>
  );
}

function ChangePinDialog({ name, action }: { name: string; action: Action }) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  useSuccessToast(state, "staff.pinSaved", () => setOpen(false));
  const error = errorText(state);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("staff.changePin")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("staff.changePinTitle", { name })}</DialogTitle>
            <DialogDescription>{t("staff.pinInvalid")}</DialogDescription>
          </DialogHeader>
          <PinInput id={inputId} label={t("staff.newPin")} />
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t("staff.savePin")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
