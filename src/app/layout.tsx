import type { Metadata } from "next"; import "./globals.css";
import { LocaleProvider } from "@/components/locale-provider";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
export const metadata:Metadata={title:"Atlas Tickets",description:"Modern ticketing for live experiences"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ru" suppressHydrationWarning><body><LocaleProvider><SiteHeader />{children}<SiteFooter /></LocaleProvider></body></html>}
