import type { EventType } from "@/lib/event-type";

export const eventDemandValues = ["POPULAR", "VERY_POPULAR"] as const;
export type EventDemandStatus = typeof eventDemandValues[number];

export const eventInsightCategoryValues = [
  "MUSICAL",
  "CONCERT",
  "THEATRE",
  "KIDS",
  "STAND_UP",
  "CLUBS_FESTIVALS",
  "PARTY",
  "FESTIVAL",
  "LIVE_MUSIC",
  "CLASSICAL",
  "SPORT",
  "LECTURE",
  "EXHIBITION",
  "WORKSHOP",
  "OTHER",
] as const;
export type EventInsightCategory = typeof eventInsightCategoryValues[number];

export type EventInsightSettings = {
  interestScore: number;
  demandStatus: EventDemandStatus;
  categories: EventInsightCategory[];
};

export const eventDemandLabels = {
  ru: { POPULAR: "Востребовано", VERY_POPULAR: "Супервостребовано" },
  he: { POPULAR: "מבוקש", VERY_POPULAR: "מבוקש במיוחד" },
  en: { POPULAR: "Selling fast", VERY_POPULAR: "Selling very fast" },
} as const;

export const eventDemandDescriptions = {
  ru: {
    POPULAR: "Это мероприятие продается очень быстро. Успейте забронировать лучшие места.",
    VERY_POPULAR: "Спрос на это мероприятие особенно высокий. Лучшие места могут закончиться в ближайшее время.",
  },
  he: {
    POPULAR: "הכרטיסים לאירוע הזה נמכרים במהירות. כדאי להזמין עכשיו את המקומות הטובים ביותר.",
    VERY_POPULAR: "הביקוש לאירוע הזה גבוה במיוחד. המקומות הטובים ביותר עלולים להיגמר בקרוב.",
  },
  en: {
    POPULAR: "Tickets for this event are selling quickly. Book now to secure the best seats.",
    VERY_POPULAR: "Demand for this event is exceptionally high. The best seats may sell out soon.",
  },
} as const;

export const eventInsightCategoryLabels = {
  ru: {
    MUSICAL: "Мюзикл", CONCERT: "Концерт", THEATRE: "Спектакль", KIDS: "Детское",
    STAND_UP: "Стендап", CLUBS_FESTIVALS: "Клубы и фестивали", PARTY: "Вечеринка",
    FESTIVAL: "Фестиваль", LIVE_MUSIC: "Живая музыка", CLASSICAL: "Классика",
    SPORT: "Спорт", LECTURE: "Лекция", EXHIBITION: "Выставка", WORKSHOP: "Мастер-класс", OTHER: "Другое",
  },
  he: {
    MUSICAL: "מחזמר", CONCERT: "הופעה", THEATRE: "תיאטרון", KIDS: "ילדים",
    STAND_UP: "סטנדאפ", CLUBS_FESTIVALS: "מועדונים ופסטיבלים", PARTY: "מסיבה",
    FESTIVAL: "פסטיבל", LIVE_MUSIC: "מוזיקה חיה", CLASSICAL: "קלאסי",
    SPORT: "ספורט", LECTURE: "הרצאה", EXHIBITION: "תערוכה", WORKSHOP: "סדנה", OTHER: "אחר",
  },
  en: {
    MUSICAL: "Musical", CONCERT: "Concert", THEATRE: "Theatre", KIDS: "Kids",
    STAND_UP: "Stand-up", CLUBS_FESTIVALS: "Clubs & festivals", PARTY: "Party",
    FESTIVAL: "Festival", LIVE_MUSIC: "Live music", CLASSICAL: "Classical",
    SPORT: "Sports", LECTURE: "Lecture", EXHIBITION: "Exhibition", WORKSHOP: "Workshop", OTHER: "Other",
  },
} as const;

export function defaultEventInsightCategories(type: EventType): EventInsightCategory[] {
  if (type === "THEATRE") return ["THEATRE"];
  if (type === "COMEDY") return ["STAND_UP"];
  if (type === "CHILDREN_SHOW") return ["KIDS"];
  if (type === "FESTIVAL") return ["FESTIVAL", "CLUBS_FESTIVALS"];
  if (type === "PARTY" || type === "DJ_SET") return ["PARTY", "CLUBS_FESTIVALS"];
  if (type === "LIVE_MUSIC") return ["LIVE_MUSIC", "CONCERT"];
  if (type === "CLASSICAL_CONCERT") return ["CLASSICAL", "CONCERT"];
  if (type === "SOLO_CONCERT") return ["CONCERT"];
  if (type === "SPORT") return ["SPORT"];
  if (type === "LECTURE" || type === "CONFERENCE") return ["LECTURE"];
  if (type === "EXHIBITION") return ["EXHIBITION"];
  if (type === "WORKSHOP") return ["WORKSHOP"];
  return ["OTHER"];
}
