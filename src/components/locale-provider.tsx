"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDictionary, isRtl, normalizeLocale, type Dictionary, type Locale } from "@/lib/i18n";

export type { Locale } from "@/lib/i18n";

type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  messages: Dictionary;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectedLocale(): Locale {
  const language = window.navigator.language.toLowerCase();
  if (language.startsWith("he")) return "he";
  if (language.startsWith("ru")) return "ru";
  return "en";
}

export function LocaleProvider({ children, initialLocale = "ru" }: { children: React.ReactNode; initialLocale?: Locale }) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  useEffect(() => {
    const saved = window.localStorage.getItem("atlas-locale");
    const next = saved ? normalizeLocale(saved) : detectedLocale();
    if (next !== locale) setLocale(next);
    // Only hydrate saved browser preference after mounting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.localStorage.setItem("atlas-locale", locale);
    document.cookie = `atlas-locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = locale;
    document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    dir: isRtl(locale) ? "rtl" : "ltr",
    messages: getDictionary(locale),
    setLocale,
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
