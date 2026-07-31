import { db } from "@/lib/db";
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

function defaultCategories(type: EventType): EventInsightCategory[] {
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

let tablePromise: Promise<void> | null = null;

export function ensureEventInsightTable() {
  if (!tablePromise) {
    tablePromise = db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "EventPublicInsight" (
      "eventId" TEXT PRIMARY KEY,
      "interestScore" INTEGER NOT NULL DEFAULT 88,
      "demandStatus" TEXT NOT NULL DEFAULT 'POPULAR',
      "categories" TEXT NOT NULL DEFAULT '[]',
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
    )`).then(() => undefined).catch(error => {
      tablePromise = null;
      throw error;
    });
  }
  return tablePromise;
}

function normalizeCategories(value: unknown, fallbackType: EventType): EventInsightCategory[] {
  if (!Array.isArray(value)) return defaultCategories(fallbackType);
  const categories = value.filter((item): item is EventInsightCategory =>
    typeof item === "string" && eventInsightCategoryValues.includes(item as EventInsightCategory),
  );
  return categories.length ? [...new Set(categories)] : defaultCategories(fallbackType);
}

export async function getEventInsights(eventId: string, fallbackType: EventType): Promise<EventInsightSettings> {
  await ensureEventInsightTable();
  const rows = await db.$queryRawUnsafe<Array<{ interestScore: number; demandStatus: string; categories: string }>>(
    `SELECT "interestScore", "demandStatus", "categories" FROM "EventPublicInsight" WHERE "eventId" = $1`,
    eventId,
  );
  const row = rows[0];
  if (!row) return { interestScore: 88, demandStatus: "POPULAR", categories: defaultCategories(fallbackType) };

  let parsedCategories: unknown = [];
  try { parsedCategories = JSON.parse(row.categories); } catch { parsedCategories = []; }
  const demandStatus = eventDemandValues.includes(row.demandStatus as EventDemandStatus)
    ? row.demandStatus as EventDemandStatus
    : "POPULAR";

  return {
    interestScore: Math.max(0, Math.min(100, Number(row.interestScore) || 88)),
    demandStatus,
    categories: normalizeCategories(parsedCategories, fallbackType),
  };
}

export async function setEventInsights(eventId: string, settings: EventInsightSettings) {
  await ensureEventInsightTable();
  const interestScore = Math.max(0, Math.min(100, Math.round(settings.interestScore)));
  const demandStatus = eventDemandValues.includes(settings.demandStatus) ? settings.demandStatus : "POPULAR";
  const categories = normalizeCategories(settings.categories, "OTHER");

  await db.$executeRawUnsafe(
    `INSERT INTO "EventPublicInsight" ("eventId", "interestScore", "demandStatus", "categories", "updatedAt")
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT ("eventId") DO UPDATE SET
       "interestScore" = EXCLUDED."interestScore",
       "demandStatus" = EXCLUDED."demandStatus",
       "categories" = EXCLUDED."categories",
       "updatedAt" = CURRENT_TIMESTAMP`,
    eventId,
    interestScore,
    demandStatus,
    JSON.stringify(categories),
  );
}
