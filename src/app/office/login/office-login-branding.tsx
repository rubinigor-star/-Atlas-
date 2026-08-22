"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";
import { localeNames } from "@/lib/i18n";
import styles from "./office-login-branding.module.css";

const locales: Locale[] = ["ru", "he", "en"];

export function OfficeLanguageControl() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  const activeName = useMemo(() => localeNames[locale], [locale]);

  function chooseLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    setOpen(false);
  }

  return <div className={styles.languageControl}>
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
  </div>;
}
