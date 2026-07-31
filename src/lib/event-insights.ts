import { db } from "@/lib/db";
import type { EventType } from "@/lib/event-type";
import {
  defaultEventInsightCategories,
  eventDemandValues,
  eventInsightCategoryValues,
  type EventDemandStatus,
  type EventInsightCategory,
  type EventInsightSettings,
} from "@/lib/event-insight-options";

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
  if (!Array.isArray(value)) return defaultEventInsightCategories(fallbackType);
  const categories = value.filter((item): item is EventInsightCategory =>
    typeof item === "string" && eventInsightCategoryValues.includes(item as EventInsightCategory),
  );
  return categories.length ? [...new Set(categories)] : defaultEventInsightCategories(fallbackType);
}

export async function getEventInsights(eventId: string, fallbackType: EventType): Promise<EventInsightSettings> {
  await ensureEventInsightTable();
  const rows = await db.$queryRawUnsafe<Array<{ interestScore: number; demandStatus: string; categories: string }>>(
    `SELECT "interestScore", "demandStatus", "categories" FROM "EventPublicInsight" WHERE "eventId" = $1`,
    eventId,
  );
  const row = rows[0];
  if (!row) return { interestScore: 88, demandStatus: "POPULAR", categories: defaultEventInsightCategories(fallbackType) };

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
