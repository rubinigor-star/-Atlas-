import type { Locale } from "@/lib/i18n";

export const eventLanguageValues = ["RU", "HE", "EN", "AR", "MULTILINGUAL", "NO_LANGUAGE_BARRIER", "OTHER"] as const;
export type EventLanguage = (typeof eventLanguageValues)[number];

export const catalogVisibilityValues = ["TARGETED", "PUBLIC", "DIRECT_ONLY"] as const;
export type CatalogVisibility = (typeof catalogVisibilityValues)[number];

export type EventLanguageSettings = {
  primaryLanguage: EventLanguage;
  catalogVisibility: CatalogVisibility;
  customerCommunicationLocale: Locale;
};

export const EVENT_LANGUAGE_COOKIE = "atlas-event-languages";

export const legacyEventLanguageSettings: EventLanguageSettings = {
  primaryLanguage: "MULTILINGUAL",
  catalogVisibility: "PUBLIC",
  customerCommunicationLocale: "ru",
};

export const eventLanguageLabels: Record<Locale, Record<EventLanguage, string>> = {
  ru: {
    RU: "Русский",
    HE: "Иврит",
    EN: "Английский",
    AR: "Арабский",
    MULTILINGUAL: "Несколько языков",
    NO_LANGUAGE_BARRIER: "Без языкового барьера",
    OTHER: "Другой язык",
  },
  he: {
    RU: "רוסית",
    HE: "עברית",
    EN: "אנגלית",
    AR: "ערבית",
    MULTILINGUAL: "מספר שפות",
    NO_LANGUAGE_BARRIER: "ללא מגבלת שפה",
    OTHER: "שפה אחרת",
  },
  en: {
    RU: "Russian",
    HE: "Hebrew",
    EN: "English",
    AR: "Arabic",
    MULTILINGUAL: "Multilingual",
    NO_LANGUAGE_BARRIER: "No language barrier",
    OTHER: "Other language",
  },
};

export function normalizeEventLanguageSettings(
  primaryLanguage: string | null | undefined,
  catalogVisibility: string | null | undefined,
  customerCommunicationLocale?: string | null,
): EventLanguageSettings {
  const normalizedPrimary = eventLanguageValues.includes(primaryLanguage as EventLanguage)
    ? primaryLanguage as EventLanguage
    : legacyEventLanguageSettings.primaryLanguage;
  return {
    primaryLanguage: normalizedPrimary,
    catalogVisibility: catalogVisibilityValues.includes(catalogVisibility as CatalogVisibility)
      ? catalogVisibility as CatalogVisibility
      : legacyEventLanguageSettings.catalogVisibility,
    customerCommunicationLocale: customerCommunicationLocale === "he" || customerCommunicationLocale === "en" || customerCommunicationLocale === "ru"
      ? customerCommunicationLocale
      : normalizedPrimary === "HE" ? "he" : normalizedPrimary === "EN" ? "en" : "ru",
  };
}

export function localeDefaultEventLanguage(locale: Locale): EventLanguage {
  return locale === "he" ? "HE" : locale === "ru" ? "RU" : "EN";
}

export function parsePreferredEventLanguages(value: string | null | undefined, locale: Locale): EventLanguage[] {
  if (!value) return [localeDefaultEventLanguage(locale)];
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  const parsed = decoded
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item): item is EventLanguage => eventLanguageValues.includes(item as EventLanguage))
    .filter((item) => item !== "MULTILINGUAL" && item !== "NO_LANGUAGE_BARRIER");
  return parsed.length ? [...new Set(parsed)] : [localeDefaultEventLanguage(locale)];
}

export function isEventVisibleInCatalog(settings: EventLanguageSettings, preferredLanguages: readonly EventLanguage[]) {
  if (settings.catalogVisibility === "DIRECT_ONLY") return false;
  if (settings.catalogVisibility === "PUBLIC") return true;
  if (settings.primaryLanguage === "MULTILINGUAL" || settings.primaryLanguage === "NO_LANGUAGE_BARRIER") return true;
  return preferredLanguages.includes(settings.primaryLanguage);
}
