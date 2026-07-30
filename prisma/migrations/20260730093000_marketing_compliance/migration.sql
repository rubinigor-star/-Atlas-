-- Atlas marketing data is intentionally separated from orders and tickets.
-- Unsubscribing never deletes or mutates purchase history.

CREATE TABLE "OrganizerMarketingProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "preferredLanguage" TEXT,
    "gender" TEXT,
    "city" TEXT,
    "firstPurchaseAt" DATETIME,
    "lastPurchaseAt" DATETIME,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpentMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizerMarketingProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizerMarketingProfile_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizerMarketingProfile_organizationId_guestId_key" ON "OrganizerMarketingProfile"("organizationId", "guestId");
CREATE INDEX "OrganizerMarketingProfile_organizationId_city_idx" ON "OrganizerMarketingProfile"("organizationId", "city");

CREATE TABLE "MarketingConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "purpose" TEXT NOT NULL DEFAULT 'MARKETING',
    "source" TEXT NOT NULL,
    "consentTextVersion" TEXT NOT NULL,
    "proofJson" TEXT,
    "grantedAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingConsent_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MarketingConsent_organizationId_guestId_channel_purpose_key" ON "MarketingConsent"("organizationId", "guestId", "channel", "purpose");
CREATE INDEX "MarketingConsent_organizationId_channel_status_idx" ON "MarketingConsent"("organizationId", "channel", "status");

CREATE TABLE "MarketingSuppression" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "channel" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'ORGANIZER_MARKETING',
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" DATETIME,
    CONSTRAINT "MarketingSuppression_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingSuppression_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "MarketingSuppression_organizationId_guestId_idx" ON "MarketingSuppression"("organizationId", "guestId");
CREATE INDEX "MarketingSuppression_organizationId_channel_releasedAt_idx" ON "MarketingSuppression"("organizationId", "channel", "releasedAt");

CREATE TABLE "MarketingCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MARKETING',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "channel" TEXT NOT NULL,
    "segmentJson" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "estimatedRecipients" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostMinor" INTEGER NOT NULL DEFAULT 0,
    "reservedCostMinor" INTEGER NOT NULL DEFAULT 0,
    "scheduledAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MarketingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "MarketingCampaign_organizationId_status_createdAt_idx" ON "MarketingCampaign"("organizationId", "status", "createdAt");

CREATE TABLE "MarketingCampaignRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "campaignId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "exclusionReason" TEXT,
    "providerMessageId" TEXT,
    "costMinor" INTEGER NOT NULL DEFAULT 0,
    "sentAt" DATETIME,
    "deliveredAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MarketingCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MarketingCampaignRecipient_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "GuestProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "MarketingCampaignRecipient_campaignId_guestId_channel_key" ON "MarketingCampaignRecipient"("campaignId", "guestId", "channel");
CREATE INDEX "MarketingCampaignRecipient_campaignId_status_idx" ON "MarketingCampaignRecipient"("campaignId", "status");

CREATE TABLE "CommunicationRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "channel" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IL',
    "providerCostMinor" INTEGER NOT NULL,
    "atlasMarkupMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "activeFrom" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activeTo" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationRate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CommunicationRate_organizationId_channel_activeFrom_idx" ON "CommunicationRate"("organizationId", "channel", "activeFrom");

CREATE TABLE "CommunicationLedger" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "campaignId" TEXT,
    "channel" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostMinor" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ILS',
    "entryType" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunicationLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunicationLedger_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CommunicationLedger_organizationId_createdAt_idx" ON "CommunicationLedger"("organizationId", "createdAt");
