"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "ru" | "he" | "en";

const messages = {
  ru: {
    events: "События",
    organizers: "Организаторам",
    checkin: "Контроль входа",
    backoffice: "Demo back-office",
    overview: "Обзор",
    requests: "Заявки на вход",
    createEvent: "Создать событие",
    orders: "Заказы",
    scanner: "Сканер",
    language: "Язык",
    russian: "Русский",
    hebrew: "עברית",
    english: "English",
    testOnly: "MVP · только тестовые платежи",
  },
  he: {
    events: "אירועים",
    organizers: "למפיקים",
    checkin: "בקרת כניסה",
    backoffice: "ממשק מפיק",
    overview: "סקירה",
    requests: "בקשות כניסה",
    createEvent: "יצירת אירוע",
    orders: "הזמנות",
    scanner: "סורק",
    language: "שפה",
    russian: "Русский",
    hebrew: "עברית",
    english: "English",
    testOnly: "MVP · תשלומי ניסיון בלבד",
  },
  en: {
    events: "Events",
    organizers: "For organizers",
    checkin: "Entry control",
    backoffice: "Demo back-office",
    overview: "Overview",
    requests: "Entry requests",
    createEvent: "Create event",
    orders: "Orders",
    scanner: "Scanner",
    language: "Language",
    russian: "Русский",
    hebrew: "עברית",
    english: "English",
    testOnly: "MVP · test payments only",
  },
} as const;

type MessageKey = keyof typeof messages.ru;
type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function detectedLocale(): Locale {
  const language = window.navigator.language.toLowerCase();
  if (language.startsWith("he")) return "he";
  if (language.startsWith("ru")) return "ru";
  return "en";
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ru");

  useEffect(() => {
    const saved = window.localStorage.getItem("atlas-locale");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(saved === "ru" || saved === "he" || saved === "en" ? saved : detectedLocale());
  }, []);

  useEffect(() => {
    window.localStorage.setItem("atlas-locale", locale);
    document.cookie = `atlas-locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    dir: locale === "he" ? "rtl" : "ltr",
    setLocale,
    t: (key) => messages[locale][key],
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
