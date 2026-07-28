"use client";

import Link from "next/link";
import { Languages } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";
import { localeNames } from "@/lib/i18n";
import { AtlasLogo } from "@/components/atlas-logo";

export function SiteHeader() {
  const { messages, locale, setLocale } = useLocale();
  return <header className="topbar"><div className="shell nav"><AtlasLogo/><nav className="navlinks">
    <Link href="/">{messages.common.events}</Link><Link href="/about">О нас</Link><Link href="/faq">FAQ</Link><Link href="/office">{messages.common.organizers}</Link><Link href="/account">{messages.common.account}</Link>
    <label className="language-switch" style={{display:"inline-flex",alignItems:"center",gap:7}}><Languages size={16} aria-hidden="true"/><span className="sr-only">{messages.common.language}</span><select aria-label={messages.common.language} value={locale} onChange={e=>setLocale(e.target.value as Locale)} style={{border:0,background:"transparent",color:"inherit",font:"inherit",fontWeight:700,cursor:"pointer",outline:"none"}}><option value="he">{localeNames.he}</option><option value="ru">{localeNames.ru}</option><option value="en">{localeNames.en}</option></select></label>
    <Link href="/office" className="btn secondary">{messages.common.backoffice}</Link>
  </nav></div></header>;
}

export function SiteFooter() {
  return <footer className="footer"><div className="shell" style={{display:"grid",gap:22}}><div className="row between"><AtlasLogo/><span>© 2026 Atlas One</span></div><nav style={{display:"flex",flexWrap:"wrap",gap:"12px 22px"}}><Link href="/about">О нас</Link><Link href="/faq">FAQ</Link><Link href="/careers">Вакансии</Link><Link href="/contact">Контакты</Link><Link href="/refund-policy">Возвраты</Link><Link href="/privacy">Конфиденциальность</Link><Link href="/terms">Условия</Link></nav></div></footer>;
}
