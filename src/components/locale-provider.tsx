"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getDictionary,
  isRtl,
  LEGACY_LOCALE_COOKIE,
  normalizeLocale,
  PLATFORM_LOCALE_COOKIE,
  localeConfig,
  type Dictionary,
  type Locale,
} from "@/lib/i18n";

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

type LocaleScope = "platform" | "staff" | "fixed";

function persistPlatformLocale(locale: Locale) {
  window.localStorage.setItem(PLATFORM_LOCALE_COOKIE, locale);
  window.localStorage.setItem(LEGACY_LOCALE_COOKIE, locale);
  document.cookie = `${PLATFORM_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `${LEGACY_LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.lang = localeConfig[locale].tag;
  document.documentElement.dir = isRtl(locale) ? "rtl" : "ltr";
}

export function LocaleProvider({
  children,
  initialLocale = "ru",
  scope = "platform",
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
  scope?: LocaleScope;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const changeLocale = useCallback((nextLocale: Locale) => {
    if (scope === "fixed") return;
    setLocaleState(nextLocale);
    if (scope === "platform") persistPlatformLocale(nextLocale);
    if (scope === "staff") {
      window.localStorage.setItem("atlas-staff-locale", nextLocale);
      void fetch("/api/office/locale", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "self", locale: nextLocale }),
      }).then((response) => {
        if (!response.ok) throw new Error("STAFF_LOCALE_UPDATE_FAILED");
        router.refresh();
      }).catch(() => {
        setLocaleState(initialLocale);
      });
    }

    // The homepage and other public pages render their localized copy on the server.
    // Refresh the React Server Components after the cookie changes so the entire
    // page, not only the client-side header, switches language and direction.
    router.refresh();
  }, [initialLocale, router, scope]);

  useEffect(() => {
    if (scope !== "platform") return;
    const saved = window.localStorage.getItem(PLATFORM_LOCALE_COOKIE)
      ?? window.localStorage.getItem(LEGACY_LOCALE_COOKIE);
    const nextLocale = saved ? normalizeLocale(saved) : detectedLocale();

    if (nextLocale !== initialLocale) {
      queueMicrotask(() => changeLocale(nextLocale));
      return;
    }

    persistPlatformLocale(initialLocale);
  }, [changeLocale, initialLocale, scope]);

  const resolvedLocale=scope==="fixed"?initialLocale:locale;

  const value = useMemo<LocaleContextValue>(() => ({
    locale:resolvedLocale,
    dir: isRtl(resolvedLocale) ? "rtl" : "ltr",
    messages: getDictionary(resolvedLocale),
    setLocale: changeLocale,
  }), [changeLocale, resolvedLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
