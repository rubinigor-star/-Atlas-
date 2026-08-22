import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "AbandonedCheckout" (
    "id" TEXT PRIMARY KEY,
    "token" TEXT NOT NULL UNIQUE,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "categoryId" TEXT,
    "communicationLocale" TEXT NOT NULL DEFAULT 'ru',
    "customerFirstName" TEXT,
    "customerLastName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "amountMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "stage" TEXT NOT NULL DEFAULT 'CHECKOUT_OPENED',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "checkoutUrl" TEXT NOT NULL,
    "orderId" TEXT,
    "metadataJson" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandonedAt" TIMESTAMP(3),
    "recoveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
  )`,
  `ALTER TABLE "AbandonedCheckout" ADD COLUMN IF NOT EXISTS "communicationLocale" TEXT NOT NULL DEFAULT 'ru'`,
  `CREATE INDEX IF NOT EXISTS "AbandonedCheckout_org_status_idx" ON "AbandonedCheckout"("organizationId", "status", "lastActivityAt")`,
  `CREATE INDEX IF NOT EXISTS "AbandonedCheckout_event_status_idx" ON "AbandonedCheckout"("eventId", "status", "lastActivityAt")`,
  `CREATE TABLE IF NOT EXISTS "RecoveryScenario" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT,
    "eventId" TEXT,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "RecoveryScenario_scope_idx" ON "RecoveryScenario"("organizationId", "eventId", "active")`,
  `CREATE TABLE IF NOT EXISTS "RecoveryScenarioStep" (
    "id" TEXT PRIMARY KEY,
    "scenarioId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "stopOnConversion" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("scenarioId") REFERENCES "RecoveryScenario"("id") ON DELETE CASCADE,
    UNIQUE("scenarioId", "position")
  )`,
  `CREATE TABLE IF NOT EXISTS "RecoveryAction" (
    "id" TEXT PRIMARY KEY,
    "checkoutId" TEXT NOT NULL,
    "scenarioStepId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "providerId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("checkoutId") REFERENCES "AbandonedCheckout"("id") ON DELETE CASCADE,
    FOREIGN KEY ("scenarioStepId") REFERENCES "RecoveryScenarioStep"("id") ON DELETE CASCADE,
    UNIQUE("checkoutId", "scenarioStepId")
  )`,
  `CREATE INDEX IF NOT EXISTS "RecoveryAction_due_idx" ON "RecoveryAction"("status", "scheduledAt")`,
  `CREATE TABLE IF NOT EXISTS "RecoveryChannel" (
    "code" TEXT PRIMARY KEY,
    "provider" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "configured" BOOLEAN NOT NULL DEFAULT FALSE,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `INSERT INTO "RecoveryChannel" ("code","provider","enabled","configured") VALUES
    ('EMAIL','RESEND',TRUE,FALSE),('SMS',NULL,FALSE,FALSE),('WHATSAPP',NULL,FALSE,FALSE)
    ON CONFLICT ("code") DO NOTHING`,
];

try {
  for (const statement of statements) await db.$executeRawUnsafe(statement);
  console.log("Abandoned checkout recovery runtime is ready.");
} finally {
  await db.$disconnect();
}
