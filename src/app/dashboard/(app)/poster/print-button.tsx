"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export function PrintButton() {
  return (
    <Button type="button" onClick={() => window.print()}>
      <Printer aria-hidden />
      {t("poster.print")}
    </Button>
  );
}
