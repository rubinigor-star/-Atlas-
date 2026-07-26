"use client";

import Link from "next/link";
import { Languages } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";
import { AtlasLogo } from "@/components/atlas-logo";

export function SiteHeader() {
  const { t, locale, setLocale } = useLocale();
  return (
    <header className="topbar">
      <div className="shell nav">
        <AtlasLogo />
        <nav className="navlinks">
          <Link href="/">{t("events")}</Link>
          <Link href="/office">{t("organizers")}</Link>
          <label className="language-switch" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
            <Languages size={16} aria-hidden="true" />
            <span className="sr-only">{t("language")}</span>
            <select
              aria-label={t("language")}
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              style={{ border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 700, cursor: "pointer", outline: "none" }}
            >
              <option value="he">{t("hebrew")}</option>
              <option value="ru">{t("russian")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </label>
          <Link href="/office" className="btn secondary">{t("backoffice")}</Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const { t } = useLocale();
  return <footer className="footer"><div className="shell row between"><AtlasLogo /><span>© 2026 Atlas One</span><span>{t("testOnly")}</span></div></footer>;
}
