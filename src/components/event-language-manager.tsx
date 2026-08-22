"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import {
  catalogVisibilityValues,
  eventLanguageLabels,
  eventLanguageValues,
  type CatalogVisibility,
  type EventLanguage,
  type EventLanguageSettings,
} from "@/lib/event-language";
import { localeNames, locales, type Locale } from "@/lib/i18n";

const copy = {
  ru: {
    eyebrow: "Язык и аудитория",
    title: "Кому показывать мероприятие",
    language: "Основной язык мероприятия",
    languageHelp: "Это язык выступления или контента, а не язык кнопок и оплаты.",
    customerLanguage: "Язык покупателя и сообщений",
    customerLanguageHelp: "На этом языке будут страница события, оформление, билеты, email, SMS, возвраты и напоминания.",
    visibility: "Видимость в каталоге",
    TARGETED: "Только подходящей языковой аудитории",
    PUBLIC: "Показывать всем пользователям",
    DIRECT_ONLY: "Только по прямой ссылке",
    targetedHelp: "Рекомендуемый режим. Событие появится у пользователей, выбравших соответствующий язык.",
    publicHelp: "Подходит для международных концертов и событий, где язык не мешает участию.",
    directHelp: "Событие не появится на главной, но реклама и прямая ссылка продолжат работать.",
    save: "Сохранить язык и аудиторию",
    saved: "✓ Настройки сохранены",
    error: "Не удалось сохранить настройки",
  },
  he: {
    eyebrow: "שפה וקהל",
    title: "למי להציג את האירוע",
    language: "השפה הראשית של האירוע",
    languageHelp: "זוהי שפת המופע או התוכן, ולא שפת הכפתורים והתשלום.",
    customerLanguage: "שפת הלקוחות וההודעות",
    customerLanguageHelp: "בשפה זו יוצגו עמוד האירוע, תהליך הרכישה, הכרטיסים, הודעות המייל וה-SMS, החזרים ותזכורות.",
    visibility: "נראות בקטלוג",
    TARGETED: "רק לקהל בשפה המתאימה",
    PUBLIC: "להציג לכל המשתמשים",
    DIRECT_ONLY: "רק באמצעות קישור ישיר",
    targetedHelp: "האפשרות המומלצת. האירוע יוצג למשתמשים שבחרו בשפה המתאימה.",
    publicHelp: "מתאים להופעות בינלאומיות ולאירועים שבהם השפה אינה מגבלה.",
    directHelp: "האירוע לא יוצג בעמוד הראשי, אך פרסום וקישור ישיר ימשיכו לעבוד.",
    save: "שמירת שפה וקהל",
    saved: "✓ ההגדרות נשמרו",
    error: "לא הצלחנו לשמור את ההגדרות",
  },
  en: {
    eyebrow: "Language and audience",
    title: "Who should see this event",
    language: "Primary event language",
    languageHelp: "This is the language of the performance or content, not the language of buttons and checkout.",
    customerLanguage: "Customer and communication language",
    customerLanguageHelp: "The event page, checkout, tickets, email, SMS, refunds and reminders use this language.",
    visibility: "Catalog visibility",
    TARGETED: "Only matching language audiences",
    PUBLIC: "Show to everyone",
    DIRECT_ONLY: "Direct link only",
    targetedHelp: "Recommended. The event appears for users who selected the matching language.",
    publicHelp: "Best for international concerts and events where language is not a barrier.",
    directHelp: "The event stays off the homepage while ads and direct links continue to work.",
    save: "Save language and audience",
    saved: "✓ Settings saved",
    error: "Could not save settings",
  },
} as const;

export function EventLanguageManager({ eventId, initial }: { eventId: string; initial: EventLanguageSettings }) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = copy[locale];
  const [primaryLanguage, setPrimaryLanguage] = useState<EventLanguage>(initial.primaryLanguage);
  const [catalogVisibility, setCatalogVisibility] = useState<CatalogVisibility>(initial.catalogVisibility);
  const [customerCommunicationLocale, setCustomerCommunicationLocale] = useState<Locale>(initial.customerCommunicationLocale);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/events/${eventId}/language`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ primaryLanguage, catalogVisibility, customerCommunicationLocale }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || text.error);
      setMessage(text.saved);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error);
    } finally {
      setBusy(false);
    }
  }

  const help = catalogVisibility === "TARGETED" ? text.targetedHelp : catalogVisibility === "PUBLIC" ? text.publicHelp : text.directHelp;

  return <form className="panel form" data-unified-save="about" onSubmit={submit}>
    <span className="eyebrow">{text.eyebrow}</span>
    <h2>{text.title}</h2>
    <div className="form-grid two">
      <div className="field">
        <label>{text.language}</label>
        <select value={primaryLanguage} onChange={(event) => setPrimaryLanguage(event.target.value as EventLanguage)} required>
          {eventLanguageValues.map((language) => <option value={language} key={language}>{eventLanguageLabels[locale][language]}</option>)}
        </select>
        <small className="muted">{text.languageHelp}</small>
      </div>
      <div className="field">
        <label>{text.visibility}</label>
        <select value={catalogVisibility} onChange={(event) => setCatalogVisibility(event.target.value as CatalogVisibility)} required>
          {catalogVisibilityValues.map((visibility) => <option value={visibility} key={visibility}>{text[visibility]}</option>)}
        </select>
        <small className="muted">{help}</small>
      </div>
      <div className="field">
        <label>{text.customerLanguage}</label>
        <select value={customerCommunicationLocale} onChange={(event) => setCustomerCommunicationLocale(event.target.value as Locale)} required>
          {locales.map((language) => <option value={language} key={language}>{localeNames[language]}</option>)}
        </select>
        <small className="muted">{text.customerLanguageHelp}</small>
      </div>
    </div>
    <button className="btn" disabled={busy} data-workspace-local-save="true">{busy ? "…" : text.save}</button>
    {message && <div className="toast save-feedback" role="status">{message}</div>}
  </form>;
}
