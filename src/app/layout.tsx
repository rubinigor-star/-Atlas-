import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { LocaleProvider } from "@/components/locale-provider";
import { AppChrome } from "@/components/app-chrome";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "Atlas Tickets",
  description: "Modern ticketing for live experiences",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Atlas Office",
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <LocaleProvider>
          <PwaRegister />
          <AppChrome>{children}</AppChrome>
        </LocaleProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
