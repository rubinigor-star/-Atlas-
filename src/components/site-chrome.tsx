"use client";

import Link from "next/link";
import { useLocale } from "@/components/locale-provider";

export function SiteHeader() {
  const { t, toggleLocale } = useLocale();
  return (
    <header className="topbar">
      <div className="shell nav">
        <Link href="/" className="brand">ATL<i>AS</i></Link>
        <nav className="navlinks">
          <Link href="/">{t("events")}</Link>
          <Link href="/office">{t("organizers")}</Link>
          <button className="language-switch" type="button" onClick={toggleLocale}>{t("language")}</button>
          <Link href="/office" className="btn secondary">{t("backoffice")}</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useLocale();
  return <footer className="footer"><div className="shell row between"><span>© 2026 Atlas Tickets</span><span>{t("testOnly")}</span></div></footer>;
}
