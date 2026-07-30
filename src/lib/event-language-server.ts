import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  legacyEventLanguageSettings,
  normalizeEventLanguageSettings,
  type EventLanguage,
  type EventLanguageSettings,
} from "@/lib/event-language";

type EventLanguageRow = {
  eventId: string;
  primaryLanguage: string;
  catalogVisibility: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

let tableInitialization: Promise<void> | undefined;

export function ensureEventLanguageSettingsTable() {
  if (!tableInitialization) {
    tableInitialization = (async () => {
      await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "EventLanguageSettings" (
        "eventId" TEXT PRIMARY KEY,
        "primaryLanguage" TEXT NOT NULL DEFAULT 'MULTILINGUAL',
        "catalogVisibility" TEXT NOT NULL DEFAULT 'PUBLIC',
        "updatedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
      )`);
      await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "EventLanguageSettings_catalog_language_idx" ON "EventLanguageSettings"("catalogVisibility", "primaryLanguage")`);
    })().catch((error) => {
      tableInitialization = undefined;
      throw error;
    });
  }
  return tableInitialization;
}

export function eventLanguageUpsertQuery(
  eventId: string,
  settings: EventLanguageSettings,
  updatedBy: string | null,
) {
  return Prisma.sql`INSERT INTO "EventLanguageSettings" ("eventId", "primaryLanguage", "catalogVisibility", "updatedBy")
    VALUES (${eventId}, ${settings.primaryLanguage}, ${settings.catalogVisibility}, ${updatedBy})
    ON CONFLICT ("eventId") DO UPDATE SET
      "primaryLanguage" = EXCLUDED."primaryLanguage",
      "catalogVisibility" = EXCLUDED."catalogVisibility",
      "updatedBy" = EXCLUDED."updatedBy",
      "updatedAt" = CURRENT_TIMESTAMP`;
}

export async function getEventLanguageSettings(eventId: string): Promise<EventLanguageSettings> {
  await ensureEventLanguageSettingsTable();
  const rows = await db.$queryRaw<EventLanguageRow[]>(Prisma.sql`
    SELECT "eventId", "primaryLanguage", "catalogVisibility", "updatedBy", "createdAt", "updatedAt"
    FROM "EventLanguageSettings"
    WHERE "eventId" = ${eventId}
    LIMIT 1
  `);
  if (!rows[0]) return legacyEventLanguageSettings;
  return normalizeEventLanguageSettings(rows[0].primaryLanguage, rows[0].catalogVisibility);
}

export async function saveEventLanguageSettings(
  eventId: string,
  settings: EventLanguageSettings,
  updatedBy: string | null,
) {
  await ensureEventLanguageSettingsTable();
  await db.$executeRaw(eventLanguageUpsertQuery(eventId, settings, updatedBy));
  return settings;
}

export async function getHiddenEventIds(preferredLanguages: readonly EventLanguage[]) {
  await ensureEventLanguageSettingsTable();
  const visibleTargetLanguages = [...new Set([
    ...preferredLanguages,
    "MULTILINGUAL" as const,
    "NO_LANGUAGE_BARRIER" as const,
  ])];
  const rows = await db.$queryRaw<Array<{ eventId: string }>>(Prisma.sql`
    SELECT "eventId"
    FROM "EventLanguageSettings"
    WHERE "catalogVisibility" = 'DIRECT_ONLY'
       OR (
         "catalogVisibility" = 'TARGETED'
         AND "primaryLanguage" NOT IN (${Prisma.join(visibleTargetLanguages)})
       )
  `);
  return rows.map((row) => row.eventId);
}
