"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{t("common.error")}</h1>
      <Button variant="outline" onClick={() => reset()}>
        {t("common.retry")}
      </Button>
    </main>
  );
}
