"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_LANGUAGE_COOKIE, eventLanguageLabels, type EventLanguage } from "@/lib/event-language";
import type { Locale } from "@/lib/i18n";

const selectableLanguages: EventLanguage[] = ["HE", "RU", "EN", "AR", "OTHER"];

const copy: Record<Locale, { title: string; hint: string; save: string; all: string }> = {
  ru: {
    title: "Языки мероприятий",
    hint: "Главная покажет события на выбранных языках. Мероприятия без языкового барьера показываются всегда.",
    save: "Применить",
    all: "Все языки",
  },
  he: {
    title: "שפות האירועים",
    hint: "בעמוד הראשי יוצגו אירועים בשפות שבחרתם. אירועים ללא מגבלת שפה מוצגים תמיד.",
    save: "החלה",
    all: "כל השפות",
  },
  en: {
    title: "Event languages",
    hint: "The homepage shows events in your selected languages. Events without a language barrier are always included.",
    save: "Apply",
    all: "All languages",
  },
};

export function EventLanguagePreferences({ locale, initial }: { locale: Locale; initial: EventLanguage[] }) {
  const router = useRouter();
  const text = copy[locale];
  const [selected, setSelected] = useState<EventLanguage[]>(initial);

  function toggle(language: EventLanguage) {
    setSelected((current) => current.includes(language) ? current.filter((item) => item !== language) : [...current, language]);
  }

  function save() {
    const value = (selected.length ? selected : initial).join(",");
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${EVENT_LANGUAGE_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    router.refresh();
  }

  function selectAll() {
    setSelected(selectableLanguages);
  }

  const summary = selected.length === selectableLanguages.length
    ? text.all
    : selected.map((language) => eventLanguageLabels[locale][language]).join(", ");

  return <details className="panel" style={{ padding: "10px 14px", minWidth: 240 }}>
    <summary style={{ cursor: "pointer", fontWeight: 700 }}>{text.title}: {summary}</summary>
    <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
      <p className="muted" style={{ margin: 0 }}>{text.hint}</p>
      {selectableLanguages.map((language) => <label className="check-row" key={language}>
        <input type="checkbox" checked={selected.includes(language)} onChange={() => toggle(language)} />
        <span><strong>{eventLanguageLabels[locale][language]}</strong></span>
      </label>)}
      <div className="row">
        <button type="button" className="btn" onClick={save}>{text.save}</button>
        <button type="button" className="btn secondary" onClick={selectAll}>{text.all}</button>
      </div>
    </div>
  </details>;
}
