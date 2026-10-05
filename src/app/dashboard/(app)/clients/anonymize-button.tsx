"use client";

import { useState, useTransition } from "react";
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
import { t } from "@/lib/i18n";

import { anonymizeCustomerAction } from "./actions";

/** "Delete data" with an explicit confirmation: the change can't be undone. */
export function AnonymizeButton({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // The row (and this button) disappears once the data is gone, so the toast
  // is raised from the action's continuation, not from component state.
  const confirm = () =>
    startTransition(async () => {
      const result = await anonymizeCustomerAction(customerId, { status: "idle" }).catch(() => ({ status: "error" as const }));
      setOpen(false);
      if (result.status === "ok") toast.success(t("clients.anonymizeDone"));
      else toast.error(t("common.error"));
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="xs" className="text-muted-foreground">
          {t("clients.anonymize")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <div className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t("clients.anonymizeTitle")}</DialogTitle>
            <DialogDescription>{t("clients.anonymizeText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" variant="destructive" disabled={pending} onClick={confirm}>
              {t("clients.anonymizeConfirm")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
