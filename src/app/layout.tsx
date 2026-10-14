import type { Metadata, Viewport } from "next";
import { Russo_One, Wix_Madefor_Display, Wix_Madefor_Text } from "next/font/google";

import { PageTransitions } from "@/components/motion/page-transitions";
import { Toaster } from "@/components/ui/sonner";
import { brand } from "@/config/brand";
import { siteUrl } from "@/lib/env";
import { t } from "@/lib/i18n";
import "@/styles/globals.css";

const text = Wix_Madefor_Text({ subsets: ["latin", "cyrillic"], variable: "--font-text", display: "swap" });
const display = Wix_Madefor_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["700", "800"],
  variable: "--font-display-face",
  display: "swap",
});
/* The wordmark and the giant scene words only. */
const brandFace = Russo_One({ subsets: ["latin", "cyrillic"], weight: "400", variable: "--font-brand-face", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: t("meta.description"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#26102f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="uk" className={`${text.variable} ${display.variable} ${brandFace.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        {children}
        <PageTransitions stampCaption={t("transitions.stampCaption")} />
        <Toaster />
      </body>
    </html>
  );
}
