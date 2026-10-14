import type { Metadata } from "next";

import { TicketGlyph } from "@/components/brand-mark";
import { PublicShell } from "@/components/public-shell";
import { isNicheSlug } from "@/config/niches";
import { accent } from "@/lib/accent";
import { t } from "@/lib/i18n";

import { LoginForm } from "./login-form";
import "./login.css";

export const metadata: Metadata = { title: t("login.title") };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const niche = typeof params.niche === "string" && isNicheSlug(params.niche) ? params.niche : undefined;
  const callbackError = params.error === "callback";

  return (
    <PublicShell>
      <div className="flex flex-1 flex-wrap items-center gap-12 lg:gap-20">
        <section className="flex w-full max-w-xl min-w-0 flex-[1_1_420px] flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-[clamp(46px,6.6vw,100px)] leading-[1.02] [&_em]:text-brand [&_em]:not-italic">
              {accent(t("login.heroTitle"))}
            </h1>
            <p className="text-ink-muted max-w-md text-lg leading-relaxed">{t("login.subtitle")}</p>
          </div>
          {callbackError ? (
            <p role="alert" className="text-sm font-semibold text-[#ffb4a8]">
              {t("login.callbackError")}
            </p>
          ) : null}
          <LoginForm niche={niche} />
        </section>

        <div className="lg-art relative hidden min-w-0 flex-[1_1_360px] justify-center md:flex" aria-hidden>
          <div className="lg-ticket">
            <div className="lg-head">
              <TicketGlyph className="text-brand-foreground [--mark-hole:var(--brand)]" />
              <b className="font-brand">Tickity</b>
            </div>
            <span className="lg-cap">{t("login.artCaption")}</span>
            <div className="lg-perf" />
            <div className="lg-holes">
              {Array.from({ length: 8 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
            <div className="lg-foot">
              <span>{t("login.artFooter")}</span>
              <b className="font-brand">№ 000001</b>
            </div>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
