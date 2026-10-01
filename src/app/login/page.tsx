import type { Metadata } from "next";

import { PublicShell } from "@/components/public-shell";
import { isNicheSlug } from "@/config/niches";
import { t } from "@/lib/i18n";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: t("login.title") };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const niche = typeof params.niche === "string" && isNicheSlug(params.niche) ? params.niche : undefined;
  const callbackError = params.error === "callback";

  return (
    <PublicShell>
      <section className="mx-auto flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t("login.title")}</h1>
          <p className="text-muted-foreground">{t("login.subtitle")}</p>
        </div>
        {callbackError ? (
          <p role="alert" className="text-destructive text-sm">
            {t("login.callbackError")}
          </p>
        ) : null}
        <LoginForm niche={niche} />
      </section>
    </PublicShell>
  );
}
