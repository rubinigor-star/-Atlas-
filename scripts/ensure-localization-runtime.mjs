import { PrismaClient } from "@prisma/client";

const connectionUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
if (!/^postgres(?:ql)?:\/\//i.test(connectionUrl)) {
  console.log("Skipping PostgreSQL localization runtime outside PostgreSQL.");
  process.exit(0);
}

const db = new PrismaClient();

try {
  const statements = [
    `ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "defaultStaffLocale" TEXT NOT NULL DEFAULT 'ru'`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "preferredLocale" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "interfaceLocaleOverride" TEXT`,
    `DO $$ DECLARE locale_column_exists BOOLEAN;
     BEGIN
       SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'Event' AND column_name = 'customerCommunicationLocale'
       ) INTO locale_column_exists;
       ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "customerCommunicationLocale" TEXT NOT NULL DEFAULT 'ru';
       IF NOT locale_column_exists AND to_regclass('"EventLanguageSettings"') IS NOT NULL THEN
         UPDATE "Event" e SET "customerCommunicationLocale" = CASE s."primaryLanguage" WHEN 'HE' THEN 'he' WHEN 'EN' THEN 'en' ELSE 'ru' END
         FROM "EventLanguageSettings" s
         WHERE s."eventId" = e."id";
       END IF;
     END $$`,
    `DO $$ DECLARE locale_column_exists BOOLEAN;
     BEGIN
       SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = 'Order' AND column_name = 'communicationLocale'
       ) INTO locale_column_exists;
       ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "communicationLocale" TEXT NOT NULL DEFAULT 'ru';
       IF NOT locale_column_exists THEN
         UPDATE "Order" o SET "communicationLocale" = e."customerCommunicationLocale"
           FROM "Event" e
          WHERE e."id" = o."eventId";
       END IF;
     END $$`,
    `DO $$ DECLARE locale_column_exists BOOLEAN;
     BEGIN
       IF to_regclass('"AbandonedCheckout"') IS NOT NULL THEN
         SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema() AND table_name = 'AbandonedCheckout' AND column_name = 'communicationLocale'
         ) INTO locale_column_exists;
         ALTER TABLE "AbandonedCheckout" ADD COLUMN IF NOT EXISTS "communicationLocale" TEXT NOT NULL DEFAULT 'ru';
         IF NOT locale_column_exists THEN
           UPDATE "AbandonedCheckout" c SET "communicationLocale" = e."customerCommunicationLocale"
             FROM "Event" e
            WHERE e."id" = c."eventId";
         END IF;
       END IF;
     END $$`,
  ];

  for (const statement of statements) await db.$executeRawUnsafe(statement);
  console.log("Localization runtime columns and locale snapshots are ready.");
} finally {
  await db.$disconnect();
}
