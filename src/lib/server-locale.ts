import { cookies, headers } from "next/headers";
import { getDictionary, isRtl, normalizeLocale, type Locale } from "@/lib/i18n";

export async function getServerLocale(): Promise<Locale> {
  const store = await cookies();
  const saved = store.get("atlas-locale")?.value;
  if (saved) return normalizeLocale(saved);
  const language = (await headers()).get("accept-language")?.toLowerCase() || "";
  if (language.startsWith("he")) return "he";
  if (language.startsWith("ru")) return "ru";
  return "en";
}

export async function getServerI18n() {
  const locale = await getServerLocale();
  return { locale, dir: isRtl(locale) ? "rtl" as const : "ltr" as const, messages: getDictionary(locale) };
}
