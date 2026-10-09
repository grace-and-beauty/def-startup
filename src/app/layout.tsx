import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/config/brand";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";
import "@/styles/globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const playfair = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: t("meta.description"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f4f2ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`${inter.variable} ${playfair.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
