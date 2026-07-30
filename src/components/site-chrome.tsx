"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BriefcaseBusiness, ChevronDown, Search, Sparkles, Ticket, UserRound } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";
import { localeNames } from "@/lib/i18n";
import { AtlasLogo } from "@/components/atlas-logo";

const footerCopy = {
  ru: {
    support: "Поддержка",
    manage: "Мои билеты",
    help: "Центр помощи",
    refunds: "Возвраты",
    guarantee: "Гарантия покупателя",
    company: "Atlas One",
    about: "Почему Atlas",
    careers: "Вакансии",
    listEvent: "Разместить мероприятие",
    contact: "Контакты",
    terms: "Условия",
    privacy: "Конфиденциальность",
    privacyChoices: "Настройки конфиденциальности",
  },
  he: {
    support: "תמיכה",
    manage: "הכרטיסים שלי",
    help: "מרכז עזרה",
    refunds: "החזרים",
    guarantee: "אחריות לקונה",
    company: "Atlas One",
    about: "למה Atlas",
    careers: "קריירה",
    listEvent: "פרסום אירוע",
    contact: "יצירת קשר",
    terms: "תנאים",
    privacy: "פרטיות",
    privacyChoices: "הגדרות פרטיות",
  },
  en: {
    support: "Support",
    manage: "Manage my tickets",
    help: "Help Centre",
    refunds: "Refunds",
    guarantee: "Buyer Guarantee",
    company: "Atlas One",
    about: "Why Atlas",
    careers: "Careers",
    listEvent: "List an event",
    contact: "Contact",
    terms: "Terms",
    privacy: "Privacy",
    privacyChoices: "Your privacy choices",
  },
} as const;

const headerCopy = {
  ru: {
    whyAtlas: "Почему Atlas",
    app: "Скачать приложение",
    search: "Поиск событий",
    account: "Личный кабинет",
    buyer: "Войти как покупатель",
    organizer: "Войти как организатор",
  },
  he: {
    whyAtlas: "למה Atlas",
    app: "הורדת האפליקציה",
    search: "חיפוש אירועים",
    account: "חשבון אישי",
    buyer: "כניסה כלקוח",
    organizer: "כניסה כמפיק אירועים",
  },
  en: {
    whyAtlas: "Why Atlas",
    app: "Get the app",
    search: "Search events",
    account: "Account",
    buyer: "Sign in as a customer",
    organizer: "Sign in as an organizer",
  },
} as const;

function AppleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.47-2.09-.49-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.3c1.29-.02 2.2.71 2.96.71.72 0 2.06-.88 3.47-.75.59.02 2.25.24 3.31 1.8-2.96 1.62-2.5 5.51.51 6.72-.59 1.55-1.36 3.09-2.25 4.5ZM12.03 7.25c-.15-2.3 1.71-4.2 3.85-4.38.3 2.66-2.41 4.65-3.85 4.38Z"/></svg>;
}

function GooglePlayMark() {
  return <svg viewBox="0 0 30 32" aria-hidden="true"><path fill="#20c15a" d="M2 2.8 17 16 2 29.2Z"/><path fill="#28a8ff" d="m2 2.8 18.1 10.4L17 16Z"/><path fill="#ff3b45" d="M2 29.2 20.1 18.8 17 16Z"/><path fill="#ffd43b" d="m17 16 3.1-2.8 6.5 3.7-6.5 1.9Z"/></svg>;
}

function InstagramMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2.2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" strokeWidth="2.2"/><circle cx="17.4" cy="6.8" r="1.2" fill="currentColor"/></svg>;
}

function FacebookMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.6 22v-8h2.8l.4-3.1h-3.2V8.9c0-.9.3-1.6 1.7-1.6H17V4.5c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.6v1.9H7.2V14H10v8h3.6Z"/></svg>;
}

function TikTokMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M14.6 2h3.1c.2 1.7 1.2 3.4 2.8 4.3.8.5 1.8.8 2.7.9v3.2c-1.7 0-3.4-.5-4.9-1.4v6.3A6.7 6.7 0 1 1 12 8.6v3.3a3.4 3.4 0 1 0 2.6 3.3V2Z"/></svg>;
}

function StoreBadge({ type }: { type: "apple" | "google" }) {
  return <span className="store-badge" aria-label={type === "apple" ? "Download on the App Store" : "Get it on Google Play"}>
    <span className="store-badge-icon">{type === "apple" ? <AppleMark/> : <GooglePlayMark/>}</span>
    <span className="store-badge-copy"><small>{type === "apple" ? "Download on the" : "GET IT ON"}</small><strong>{type === "apple" ? "App Store" : "Google Play"}</strong></span>
  </span>;
}

export function SiteHeader() {
  const { messages, locale, setLocale } = useLocale();
  const copy = headerCopy[locale];
  const [accountOpen, setAccountOpen] = useState(false);
  const [appBusy, setAppBusy] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const appTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!accountOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [accountOpen]);

  useEffect(() => () => {
    if (appTimerRef.current !== null) window.clearTimeout(appTimerRef.current);
  }, []);

  const playAppButtonFeedback = () => {
    if (appTimerRef.current !== null) window.clearTimeout(appTimerRef.current);
    setAppBusy(false);
    window.requestAnimationFrame(() => {
      setAppBusy(true);
      appTimerRef.current = window.setTimeout(() => setAppBusy(false), 900);
    });
  };

  const openEvents = () => {
    const events = document.getElementById("events");
    if (events) {
      events.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.location.assign("/#events");
  };

  return <header className="topbar atlas-site-header">
    <div className="atlas-header-shell">
      <div className="atlas-header-brand">
        <AtlasLogo/>
        <span className="atlas-header-divider" aria-hidden="true"/>
        <label className="atlas-header-language">
          <span className="sr-only">{messages.common.language}</span>
          <select aria-label={messages.common.language} value={locale} onChange={event=>setLocale(event.target.value as Locale)}>
            <option value="ru">{localeNames.ru}</option>
            <option value="he">{localeNames.he}</option>
            <option value="en">{localeNames.en}</option>
          </select>
          <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true"/>
        </label>
      </div>

      <nav className="atlas-header-nav" aria-label="Primary navigation">
        <Link href="/">{messages.common.events}</Link>
        <Link href="/about">{copy.whyAtlas}</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/office">{messages.common.organizers}</Link>
        <Link href="/account">{messages.common.account}</Link>
      </nav>

      <div className="atlas-header-actions">
        <button
          type="button"
          className="atlas-app-cta"
          data-loading={appBusy ? "true" : "false"}
          aria-busy={appBusy}
          onClick={playAppButtonFeedback}
        >
          <Sparkles size={17} strokeWidth={1.8} aria-hidden="true"/>
          <span>{copy.app}</span>
          <i aria-hidden="true"/>
        </button>

        <button type="button" className="atlas-header-icon-button" aria-label={copy.search} title={copy.search} onClick={openEvents}>
          <Search size={23} strokeWidth={1.8} aria-hidden="true"/>
        </button>

        <div className="atlas-account-wrap" ref={accountRef}>
          <button
            type="button"
            className="atlas-header-icon-button atlas-account-button"
            aria-label={copy.account}
            aria-haspopup="menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(open => !open)}
          >
            <UserRound size={24} strokeWidth={1.75} aria-hidden="true"/>
          </button>

          {accountOpen && <div className="atlas-account-menu" role="menu" aria-label={copy.account}>
            <Link href="/account" className="atlas-account-menu-item atlas-account-menu-buyer" role="menuitem" onClick={() => setAccountOpen(false)}>
              <span className="atlas-account-menu-icon"><Ticket size={20} strokeWidth={1.8} aria-hidden="true"/></span>
              <strong>{copy.buyer}</strong>
            </Link>
            <Link href="/office" className="atlas-account-menu-item" role="menuitem" onClick={() => setAccountOpen(false)}>
              <span className="atlas-account-menu-icon"><BriefcaseBusiness size={20} strokeWidth={1.8} aria-hidden="true"/></span>
              <strong>{copy.organizer}</strong>
            </Link>
          </div>}
        </div>
      </div>
    </div>
  </header>;
}

export function SiteFooter() {
  const { locale } = useLocale();
  const text = footerCopy[locale];
  return <footer className="footer atlas-footer">
    <div className="shell atlas-footer-shell">
      <div className="atlas-footer-main">
        <div className="atlas-footer-brand">
          <AtlasLogo dark/>
          <div className="store-badges" aria-label="Mobile applications">
            <StoreBadge type="apple"/>
            <StoreBadge type="google"/>
          </div>
        </div>

        <nav className="atlas-footer-column" aria-label={text.support}>
          <h2>{text.support}</h2>
          <Link href="/account">{text.manage}</Link>
          <Link href="/faq">{text.help}</Link>
          <Link href="/refund-policy">{text.refunds}</Link>
          <Link href="/terms">{text.guarantee}</Link>
        </nav>

        <nav className="atlas-footer-column" aria-label={text.company}>
          <h2>{text.company}</h2>
          <Link href="/about">{text.about}</Link>
          <Link href="/careers">{text.careers}</Link>
          <Link href="/office">{text.listEvent}</Link>
          <Link href="/contact">{text.contact}</Link>
        </nav>
      </div>

      <div className="atlas-footer-bottom">
        <div className="footer-socials" aria-label="Social media">
          <span className="footer-social-link" aria-label="Instagram"><InstagramMark/></span>
          <span className="footer-social-link" aria-label="Facebook"><FacebookMark/></span>
          <span className="footer-social-link" aria-label="TikTok"><TikTokMark/></span>
        </div>
        <div className="footer-legal">
          <span>© 2026 Atlas One Group, Inc.</span>
          <Link href="/terms">{text.terms}</Link>
          <Link href="/privacy">{text.privacy}</Link>
          <Link href="/privacy">{text.privacyChoices}</Link>
        </div>
      </div>
    </div>
  </footer>;
}
