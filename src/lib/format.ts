import type { Locale } from "@/lib/i18n";

const intlLocale: Record<Locale, string> = { ru: "ru-IL", he: "he-IL", en: "en-IL" };
const ISRAEL_TIME_ZONE = "Asia/Jerusalem";

export function money(minor: number, currency = "ILS", locale: Locale = "he") {
  return new Intl.NumberFormat(intlLocale[locale], { style: "currency", currency, maximumFractionDigits: 0 }).format(minor / 100);
}

export function eventDate(date: Date, locale: Locale = "ru") {
  return new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "long", timeStyle: "short", timeZone: ISRAEL_TIME_ZONE }).format(date);
}

export function israelDateTime(date: Date, locale: Locale = "ru") {
  return new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "short", timeStyle: "short", timeZone: ISRAEL_TIME_ZONE }).format(date);
}
