"use client";

import { Languages } from "lucide-react";
import { useLocale, type Locale } from "@/components/locale-provider";

const labels: Record<Locale, string> = { ru: "Русский", he: "עברית", en: "English" };
const languageLabels: Record<Locale, string> = { ru: "Язык", he: "שפה", en: "Language" };

export function OfficeLanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useLocale();
  const languageLabel = languageLabels[locale];

  return <label className="office-language-switch" title={languageLabel} style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: compact ? 44 : undefined }}>
    <Languages size={18} aria-hidden="true" />
    {!compact && <span>{languageLabel}</span>}
    <select aria-label={languageLabel} value={locale} onChange={(event) => setLocale(event.target.value as Locale)} style={{ border: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: 700, cursor: "pointer", minWidth: compact ? 0 : 92 }}>
      {(Object.keys(labels) as Locale[]).map((key) => <option key={key} value={key}>{labels[key]}</option>)}
    </select>
  </label>;
}
