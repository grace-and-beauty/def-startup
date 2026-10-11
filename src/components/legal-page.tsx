import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicShell } from "@/components/public-shell";
import { brand } from "@/config/brand";
import {
  getLegalDoc,
  LEGAL_DOCS,
  LEGAL_UI,
  LEGAL_UPDATED_AT,
  legalPath,
  type LegalBlock,
  type LegalDocId,
  type LegalLocale,
} from "@/config/legal";

export function legalStaticParams() {
  return LEGAL_DOCS.map((doc) => ({ doc }));
}

export function legalMetadata(docId: string, locale: LegalLocale): Metadata {
  const doc = getLegalDoc(docId, locale);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.summary,
    alternates: {
      canonical: legalPath(docId as LegalDocId, locale),
      languages: {
        uk: legalPath(docId as LegalDocId, "uk"),
        en: legalPath(docId as LegalDocId, "en"),
      },
    },
  };
}

function Block({ block }: { block: LegalBlock }) {
  if (typeof block === "string") return <p>{block}</p>;
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5">
      {block.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** /legal/[doc] and /en/legal/[doc]: terms, privacy, refunds (src/config/legal). */
export function LegalPage({ docId, locale }: { docId: string; locale: LegalLocale }) {
  const doc = getLegalDoc(docId, locale);
  if (!doc) notFound();

  const ui = LEGAL_UI[locale];
  const otherLocale: LegalLocale = locale === "uk" ? "en" : "uk";
  const updated = new Intl.DateTimeFormat(ui.dateLocale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(LEGAL_UPDATED_AT),
  );
  const others = LEGAL_DOCS.filter((id) => id !== docId);

  return (
    <PublicShell>
      <article lang={locale} className="flex max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {doc.title}
          </h1>
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              {brand.name} · {ui.updated} {updated}
            </span>
            <Link
              href={legalPath(docId as LegalDocId, otherLocale)}
              hrefLang={otherLocale}
              className="text-foreground underline underline-offset-4"
            >
              {ui.switchLabel}
            </Link>
          </p>
        </header>

        {doc.sections.map((section) => (
          <section key={section.heading} className="flex flex-col gap-3 leading-relaxed">
            <h2 className="font-display text-xl font-semibold">{section.heading}</h2>
            {section.blocks.map((block, index) => (
              <Block key={index} block={block} />
            ))}
          </section>
        ))}

        <nav aria-label={ui.otherDocs} className="flex flex-col gap-2 border-t pt-6 text-sm">
          <span className="text-muted-foreground">{ui.otherDocs}</span>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {others.map((id) => (
              <Link key={id} href={legalPath(id, locale)} className="underline underline-offset-4">
                {getLegalDoc(id, locale)?.title}
              </Link>
            ))}
          </div>
        </nav>
      </article>
    </PublicShell>
  );
}
