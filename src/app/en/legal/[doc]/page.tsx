import type { Metadata } from "next";

import { LegalPage, legalMetadata, legalStaticParams } from "@/components/legal-page";

export const dynamicParams = false;

export function generateStaticParams() {
  return legalStaticParams();
}

export async function generateMetadata({ params }: PageProps<"/en/legal/[doc]">): Promise<Metadata> {
  return legalMetadata((await params).doc, "en");
}

export default async function LegalDocPage({ params }: PageProps<"/en/legal/[doc]">) {
  return <LegalPage docId={(await params).doc} locale="en" />;
}
