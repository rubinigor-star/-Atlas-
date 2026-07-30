"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function persistBrowserLocale(locale: Locale) {
  window.localStorage.setItem("atlas-locale", locale);
  document.cookie = `atlas-locale=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = locale;
  document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
}

export function LocaleProvider({ children, initialLocale = "ru" }: { children: React.ReactNode; initialLocale?: Locale }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const changeLocale = useCallback((nextLocale: Locale) => {
    persistBrowserLocale(nextLocale);
    setLocaleState(nextLocale);

    // The homepage and other public pages render their localized copy on the server.
    // Refresh the React Server Components after the cookie changes so the entire
    // page, not only the client-side header, switches language and direction.
    router.refresh();
  }, [router]);

  useEffect(() => {
    const saved = window.localStorage.getItem("atlas-locale");
    const nextLocale = saved ? normalizeLocale(saved) : detectedLocale();

    if (nextLocale !== initialLocale) {
      changeLocale(nextLocale);
      return;
    }

    persistBrowserLocale(initialLocale);
    setLocaleState(initialLocale);
  }, [changeLocale, initialLocale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    dir: isRtl(locale) ? "rtl" : "ltr",
    messages: getDictionary(locale),
    setLocale: changeLocale,
  }), [changeLocale, locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
