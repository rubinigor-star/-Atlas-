import { db } from "@/lib/db";

let ensurePromise: Promise<void> | null = null;

export function ensureExternalTicketStorage() {
  if (ensurePromise) return ensurePromise;
  ensurePromise = (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ExternalTicketSource" (
      "id" TEXT PRIMARY KEY,
      "eventId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sourceKey" TEXT NOT NULL,
      "platformKey" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExternalTicketSource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
    )`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ExternalTicketSource_eventId_sourceKey_key" ON "ExternalTicketSource"("eventId","sourceKey")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExternalTicketSource_eventId_idx" ON "ExternalTicketSource"("eventId")`);

    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ExternalTicketImportBatch" (
      "id" TEXT PRIMARY KEY,
      "sourceId" TEXT NOT NULL,
      "fileName" TEXT,
      "rowCount" INTEGER NOT NULL DEFAULT 0,
      "insertedCount" INTEGER NOT NULL DEFAULT 0,
      "updatedCount" INTEGER NOT NULL DEFAULT 0,
      "errorCount" INTEGER NOT NULL DEFAULT 0,
      "mappingJson" TEXT,
      "createdById" TEXT,
      "importedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExternalTicketImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalTicketSource"("id") ON DELETE CASCADE,
      CONSTRAINT "ExternalTicketImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExternalTicketImportBatch_sourceId_importedAt_idx" ON "ExternalTicketImportBatch"("sourceId","importedAt")`);

    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ExternalTicket" (
      "id" TEXT PRIMARY KEY,
      "eventId" TEXT NOT NULL,
      "sourceId" TEXT NOT NULL,
      "importBatchId" TEXT,
      "externalTicketId" TEXT NOT NULL,
      "externalOrderId" TEXT,
      "rawScanCode" TEXT NOT NULL,
      "normalizedScanCode" TEXT NOT NULL,
      "holderName" TEXT,
      "phone" TEXT,
      "email" TEXT,
      "ticketType" TEXT,
      "priceMinor" INTEGER,
      "currency" TEXT NOT NULL DEFAULT 'ILS',
      "status" TEXT NOT NULL DEFAULT 'VALID',
      "metadataJson" TEXT,
      "scannedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExternalTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE,
      CONSTRAINT "ExternalTicket_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalTicketSource"("id") ON DELETE CASCADE,
      CONSTRAINT "ExternalTicket_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ExternalTicketImportBatch"("id") ON DELETE SET NULL
    )`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ExternalTicket_sourceId_externalTicketId_key" ON "ExternalTicket"("sourceId","externalTicketId")`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "ExternalTicket_sourceId_normalizedScanCode_key" ON "ExternalTicket"("sourceId","normalizedScanCode")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExternalTicket_eventId_normalizedScanCode_idx" ON "ExternalTicket"("eventId","normalizedScanCode")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExternalTicket_eventId_status_idx" ON "ExternalTicket"("eventId","status")`);

    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "ExternalTicketScan" (
      "id" TEXT PRIMARY KEY,
      "externalTicketId" TEXT NOT NULL,
      "result" TEXT NOT NULL,
      "scannedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ExternalTicketScan_externalTicketId_fkey" FOREIGN KEY ("externalTicketId") REFERENCES "ExternalTicket"("id") ON DELETE CASCADE
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExternalTicketScan_externalTicketId_scannedAt_idx" ON "ExternalTicketScan"("externalTicketId","scannedAt")`);
  })().catch((error) => {
    ensurePromise = null;
    throw error;
  });
  return ensurePromise;
}
