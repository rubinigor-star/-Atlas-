import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./logo.css";
import "./tour.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LocaleProvider } from "@/components/locale-provider";
import { AppChrome } from "@/components/app-chrome";
import { PwaRegister } from "@/components/pwa-register";
import { getServerI18n } from "@/lib/server-locale";

export const metadata: Metadata = {
  title: "Atlas One",
  description: "Modern ticketing for live experiences",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Atlas One",
  },
  icons: {
    icon: "/atlas-app-icon.svg",
    apple: "/atlas-app-icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#081426",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dir } = await getServerI18n();
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <LocaleProvider initialLocale={locale}>
          <PwaRegister />
          <AppChrome>{children}</AppChrome>
        </LocaleProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
