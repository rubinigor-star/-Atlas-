import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

try {
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
  console.log("Event language settings runtime table is ready.");
} finally {
  await db.$disconnect();
}
