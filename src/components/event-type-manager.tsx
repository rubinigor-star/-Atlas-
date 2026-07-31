"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/locale-provider";
import { eventTypeLabels, eventTypeValues, type EventType } from "@/lib/event-type";
import {
  eventDemandLabels,
  eventDemandValues,
  eventInsightCategoryLabels,
  eventInsightCategoryValues,
  type EventDemandStatus,
  type EventInsightCategory,
  type EventInsightSettings,
} from "@/lib/event-insight-options";

const headings = {
  ru: {
    eyebrow: "Классификация",
    title: "Категории и востребованность",
    help: "Эти параметры отображаются под названием мероприятия на публичной странице.",
    primary: "Основной тип мероприятия",
    demand: "Статус спроса",
    interest: "Интерес аудитории, %",
    categories: "Подходящие категории",
    categoriesHelp: "Можно выбрать несколько категорий. При наведении посетитель увидит полный список.",
    save: "Сохранить отображение",
    saved: "✓ Настройки отображения сохранены",
    error: "Не удалось сохранить настройки",
  },
  he: {
    eyebrow: "סיווג",
    title: "קטגוריות וביקוש",
    help: "הפרטים האלה יוצגו מתחת לשם האירוע בעמוד הציבורי.",
    primary: "סוג האירוע הראשי",
    demand: "סטטוס ביקוש",
    interest: "עניין הקהל, %",
    categories: "קטגוריות מתאימות",
    categoriesHelp: "אפשר לבחור כמה קטגוריות. בריחוף יוצג למבקר הרשימה המלאה.",
    save: "שמירת התצוגה",
    saved: "✓ הגדרות התצוגה נשמרו",
    error: "לא ניתן לשמור את ההגדרות",
  },
  en: {
    eyebrow: "Classification",
    title: "Categories and demand",
    help: "These details appear beneath the event title on the public page.",
    primary: "Primary event type",
    demand: "Demand status",
    interest: "Audience interest, %",
    categories: "Matching categories",
    categoriesHelp: "Select multiple categories. Visitors will see the full list on hover.",
    save: "Save display settings",
    saved: "✓ Display settings saved",
    error: "Could not save settings",
  },
} as const;

export function EventTypeManager({
  eventId,
  initialType,
  initialInsights,
}: {
  eventId: string;
  initialType: EventType;
  initialInsights: EventInsightSettings;
}) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = headings[locale];
  const [type, setType] = useState<EventType>(initialType);
  const [interestScore, setInterestScore] = useState(initialInsights.interestScore);
  const [demandStatus, setDemandStatus] = useState<EventDemandStatus>(initialInsights.demandStatus);
  const [categories, setCategories] = useState<EventInsightCategory[]>(initialInsights.categories);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleCategory(category: EventInsightCategory) {
    setCategories(current => current.includes(category)
      ? current.length > 1 ? current.filter(item => item !== category) : current
      : [...current, category]);
  }

  async function save() {
    setMessage("");
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/events/${eventId}/insights`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventType: type, interestScore, demandStatus, categories }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || text.error);
      setMessage(text.saved);
      router.refresh();
      window.setTimeout(() => setMessage(""), 2600);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : text.error);
    } finally {
      setSaving(false);
    }
  }

  return <section className="panel form event-insight-manager">
    <span className="eyebrow">{text.eyebrow}</span>
    <h2>{text.title}</h2>
    <p className="muted">{text.help}</p>

    <div className="form-grid three event-insight-manager-fields">
      <label className="field">
        <span>{text.primary}</span>
        <select value={type} onChange={event => setType(event.target.value as EventType)}>
          {eventTypeValues.map(value => <option key={value} value={value}>{eventTypeLabels[locale][value]}</option>)}
        </select>
      </label>

      <label className="field">
        <span>{text.demand}</span>
        <select value={demandStatus} onChange={event => setDemandStatus(event.target.value as EventDemandStatus)}>
          {eventDemandValues.map(value => <option key={value} value={value}>{eventDemandLabels[locale][value]}</option>)}
        </select>
      </label>

      <label className="field">
        <span>{text.interest}</span>
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          value={interestScore}
          onChange={event => setInterestScore(Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
        />
      </label>
    </div>

    <div className="event-insight-category-manager">
      <strong>{text.categories}</strong>
      <p className="muted">{text.categoriesHelp}</p>
      <div className="event-insight-category-options">
        {eventInsightCategoryValues.map(category => <label className="event-insight-category-option" data-selected={categories.includes(category) ? "true" : "false"} key={category}>
          <input
            type="checkbox"
            checked={categories.includes(category)}
            onChange={() => toggleCategory(category)}
          />
          <span>{eventInsightCategoryLabels[locale][category]}</span>
        </label>)}
      </div>
    </div>

    <div className="row">
      <button type="button" className="btn" disabled={saving} onClick={() => void save()}>{text.save}</button>
      {message && <span className="muted" role="status">{message}</span>}
    </div>
  </section>;
}
