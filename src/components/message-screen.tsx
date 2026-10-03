import Link from "next/link";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

interface MessageScreenProps {
  title: string;
  text: string;
  showHomeLink?: boolean;
}

/** Centered full-page notice: not found, service unavailable, etc. */
export function MessageScreen({ title, text, showHomeLink = true }: MessageScreenProps) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{text}</p>
      {showHomeLink ? (
        <Button asChild variant="outline">
          <Link href="/">{t("common.toHome")}</Link>
        </Button>
      ) : null}
    </main>
  );
}

export function ServiceUnavailable() {
  return (
    <MessageScreen title={t("unavailable.title")} text={t("unavailable.text")} showHomeLink={false} />
  );
}
