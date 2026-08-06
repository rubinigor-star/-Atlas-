"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Locale } from "@/components/locale-provider";
import { localeNames } from "@/lib/i18n";
import { atlasBackstageLogoDataUrl } from "@/lib/atlas-backstage-logo";
import styles from "./office-login-branding.module.css";

const locales: Locale[] = ["ru", "he", "en"];

function isLocale(value: string | null | undefined): value is Locale {
  return value === "ru" || value === "he" || value === "en";
}

function useLogoObjectUrl() {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const comma = atlasBackstageLogoDataUrl.indexOf(",");
    if (comma < 0) return;

    const binary = window.atob(atlasBackstageLogoDataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);

    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, []);

  return url;
}

export function BackstageLogo({ className }: { className?: string }) {
  const logoUrl = useLogoObjectUrl();
  return logoUrl ? <img className={className} src={logoUrl} alt="Atlas One Backstage" /> : <span className={styles.logoPlaceholder} aria-hidden="true" />;
}

export function OfficeLoginTopbar() {
  const [locale, setLocale] = useState<Locale>("ru");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const htmlLocale = document.documentElement.lang?.slice(0, 2);
    const storedLocale = window.localStorage.getItem("atlas-locale");
    const resolved = isLocale(storedLocale) ? storedLocale : isLocale(htmlLocale) ? htmlLocale : "ru";
    setLocale(resolved);
  }, []);

  const activeName = useMemo(() => localeNames[locale], [locale]);

  function chooseLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setOpen(false);
    window.localStorage.setItem("atlas-locale", nextLocale);
    document.cookie = `atlas_locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = nextLocale === "he" ? "rtl" : "ltr";
    window.location.reload();
  }

  return <div className={styles.loginTopbar}>
    <BackstageLogo className={styles.topbarLogo} />
    <div className={styles.languageControl}>
      <button type="button" className={styles.languageButton} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(value => !value)}>
        <span>{activeName}</span>
        <ChevronDown size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && <div className={styles.languageMenu} role="menu">
        {locales.map(option => <button
          type="button"
          role="menuitemradio"
          aria-checked={option === locale}
          data-selected={option === locale ? "true" : "false"}
          key={option}
          onClick={() => chooseLocale(option)}
        >{localeNames[option]}</button>)}
      </div>}
    </div>
  </div>;
}
