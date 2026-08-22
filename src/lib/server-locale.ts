import { cookies, headers } from "next/headers";
import {
  getDictionary,
  isRtl,
  LEGACY_LOCALE_COOKIE,
  PLATFORM_LOCALE_COOKIE,
  resolvePlatformLocale,
  type Locale,
} from "@/lib/i18n";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const saved = store.get(PLATFORM_LOCALE_COOKIE)?.value
    ?? store.get(LEGACY_LOCALE_COOKIE)?.value;
  const language = (await headers()).get("accept-language");
  return resolvePlatformLocale({ savedPreference: saved, browserPreference: language });
}

export async function getServerI18n() {
  const locale = await getServerLocale();
  return { locale, dir: isRtl(locale) ? "rtl" as const : "ltr" as const, messages: getDictionary(locale) };
}
