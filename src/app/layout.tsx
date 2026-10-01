import type { Metadata, Viewport } from "next";

import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/config/brand";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";
import "@/styles/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: t("meta.description"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className="h-full">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
