"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "ru" | "he";

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
    language: "עברית",
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
    language: "Русский",
    testOnly: "MVP · תשלומי ניסיון בלבד",
  },
} as const;

type MessageKey = keyof typeof messages.ru;
type LocaleContextValue = {
  locale: Locale;
  dir: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (key: MessageKey) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ru");

  useEffect(() => {
    const saved = window.localStorage.getItem("atlas-locale");
    // Hydrate the persisted user preference only after the client mounts.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "ru" || saved === "he") setLocale(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("atlas-locale", locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "he" ? "rtl" : "ltr";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    dir: locale === "he" ? "rtl" : "ltr",
    setLocale,
    toggleLocale: () => setLocale((current) => current === "ru" ? "he" : "ru"),
    t: (key) => messages[locale][key],
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
