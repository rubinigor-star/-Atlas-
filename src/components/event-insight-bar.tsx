import { Flame, Music2, TicketCheck } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { EventType } from "@/lib/event-type";
import {
  eventDemandDescriptions,
  eventDemandLabels,
  eventInsightCategoryLabels,
} from "@/lib/event-insight-options";
import { getEventInsights } from "@/lib/event-insights";

const copy = {
  ru: {
    label: "Информация о мероприятии",
    interest: "Интерес",
    interestTitle: "Интерес аудитории",
    interestDescription: "Показатель интереса посетителей к этому мероприятию.",
    categoriesTitle: "Подходит для категорий",
  },
  he: {
    label: "מידע על האירוע",
    interest: "עניין",
    interestTitle: "עניין הקהל",
    interestDescription: "מדד העניין של המבקרים באירוע הזה.",
    categoriesTitle: "האירוע מתאים לקטגוריות",
  },
  en: {
    label: "Event information",
    interest: "Interest",
    interestTitle: "Audience interest",
    interestDescription: "An indicator of visitor interest in this event.",
    categoriesTitle: "This event matches",
  },
} as const;

export async function EventInsightBar({
  eventId,
  eventType,
  locale,
}: {
  eventId: string;
  eventType: EventType;
  locale: Locale;
}) {
  const insights = await getEventInsights(eventId, eventType);
  const text = copy[locale];
  const mainCategory = insights.categories[0] ?? "OTHER";

  return <div className="event-insight-bar" aria-label={text.label}>
    <div className="event-insight-cell" tabIndex={0} aria-describedby={`event-interest-${eventId}`}>
      <TicketCheck size={19} aria-hidden="true" />
      <span className="event-insight-value">{insights.interestScore}%</span>
      <span className="event-insight-label">{text.interest}</span>
      <div className="event-insight-tooltip" id={`event-interest-${eventId}`} role="tooltip">
        <strong>{text.interestTitle}</strong>
        <p>{text.interestDescription}</p>
      </div>
    </div>

    <div className="event-insight-cell event-insight-demand" tabIndex={0} aria-describedby={`event-demand-${eventId}`}>
      <Flame size={19} aria-hidden="true" />
      <span className="event-insight-value">{eventDemandLabels[locale][insights.demandStatus]}</span>
      <div className="event-insight-tooltip" id={`event-demand-${eventId}`} role="tooltip">
        <Flame className="event-insight-tooltip-icon" size={28} aria-hidden="true" />
        <strong>{eventDemandLabels[locale][insights.demandStatus]}</strong>
        <p>{eventDemandDescriptions[locale][insights.demandStatus]}</p>
      </div>
    </div>

    <div className="event-insight-cell" tabIndex={0} aria-describedby={`event-categories-${eventId}`}>
      <Music2 size={19} aria-hidden="true" />
      <span className="event-insight-value">{eventInsightCategoryLabels[locale][mainCategory]}</span>
      {insights.categories.length > 1 && <span className="event-insight-count">+{insights.categories.length - 1}</span>}
      <div className="event-insight-tooltip event-insight-categories-tooltip" id={`event-categories-${eventId}`} role="tooltip">
        <strong>{text.categoriesTitle}</strong>
        <div className="event-insight-category-list">
          {insights.categories.map(category => <span key={category}>{eventInsightCategoryLabels[locale][category]}</span>)}
        </div>
      </div>
    </div>
  </div>;
}
