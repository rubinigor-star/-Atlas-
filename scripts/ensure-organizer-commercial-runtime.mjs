import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const statements = [
  `CREATE TABLE IF NOT EXISTS "OrganizerCommercialTerms" (
    "organizationId" TEXT PRIMARY KEY,
    "salesFeePercentBps" INTEGER NOT NULL DEFAULT 500,
    "salesFeeFixedMinor" INTEGER NOT NULL DEFAULT 0,
    "serviceFeePayer" TEXT NOT NULL DEFAULT 'BUYER',
    "refundsEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "refundFeePercentBps" INTEGER NOT NULL DEFAULT 0,
    "refundFeeFixedMinor" INTEGER NOT NULL DEFAULT 0,
    "refundDeadlineHours" INTEGER NOT NULL DEFAULT 48,
    "transferRefundWindowDays" INTEGER NOT NULL DEFAULT 7,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "EventCommercialTerms" (
    "eventId" TEXT PRIMARY KEY,
    "useOrganizerDefaults" BOOLEAN NOT NULL DEFAULT TRUE,
    "serviceFeePayer" TEXT,
    "refundsEnabled" BOOLEAN,
    "refundFeePercentBps" INTEGER,
    "refundFeeFixedMinor" INTEGER,
    "refundDeadlineHours" INTEGER,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "CommercialTermsAudit" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS "CommercialTermsAudit_org_created_idx" ON "CommercialTermsAudit"("organizationId", "createdAt")`,
];

try {
  for (const statement of statements) await db.$executeRawUnsafe(statement);
  console.log("Organizer commercial terms runtime tables are ready.");
} finally {
  await db.$disconnect();
}
