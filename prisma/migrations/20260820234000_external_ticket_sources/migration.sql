-- External ticketing is intentionally separated from Atlas native orders and finance.
-- These tables let an event accept and scan tickets sold by third-party platforms.

CREATE TABLE "ExternalTicketSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "platformKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalTicketSource_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExternalTicketSource_eventId_sourceKey_key" ON "ExternalTicketSource"("eventId", "sourceKey");
CREATE INDEX "ExternalTicketSource_eventId_idx" ON "ExternalTicketSource"("eventId");

CREATE TABLE "ExternalTicketImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "insertedCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "mappingJson" TEXT,
    "createdById" TEXT,
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalTicketImportBatch_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalTicketSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalTicketImportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "ExternalTicketImportBatch_sourceId_importedAt_idx" ON "ExternalTicketImportBatch"("sourceId", "importedAt");

CREATE TABLE "ExternalTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "scannedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalTicket_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalTicket_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ExternalTicketSource" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExternalTicket_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ExternalTicketImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ExternalTicket_sourceId_externalTicketId_key" ON "ExternalTicket"("sourceId", "externalTicketId");
CREATE UNIQUE INDEX "ExternalTicket_sourceId_normalizedScanCode_key" ON "ExternalTicket"("sourceId", "normalizedScanCode");
CREATE INDEX "ExternalTicket_eventId_normalizedScanCode_idx" ON "ExternalTicket"("eventId", "normalizedScanCode");
CREATE INDEX "ExternalTicket_eventId_status_idx" ON "ExternalTicket"("eventId", "status");

CREATE TABLE "ExternalTicketScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalTicketId" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "scannedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalTicketScan_externalTicketId_fkey" FOREIGN KEY ("externalTicketId") REFERENCES "ExternalTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ExternalTicketScan_externalTicketId_scannedAt_idx" ON "ExternalTicketScan"("externalTicketId", "scannedAt");
