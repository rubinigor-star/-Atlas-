import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

export function ensureMarketingRuntime() {
  if (!ready) ready = (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketingVisit" ("id" TEXT PRIMARY KEY, "sessionId" TEXT NOT NULL, "eventId" TEXT, "source" TEXT, "medium" TEXT, "campaign" TEXT, "content" TEXT, "term" TEXT, "landingPath" TEXT, "referrer" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketingVisit_session_idx" ON "MarketingVisit"("sessionId", "createdAt")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketingVisit_event_idx" ON "MarketingVisit"("eventId", "createdAt")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderMarketingAttribution" ("id" TEXT PRIMARY KEY, "orderId" TEXT NOT NULL UNIQUE, "sessionId" TEXT, "source" TEXT, "medium" TEXT, "campaign" TEXT, "content" TEXT, "term" TEXT, "landingPath" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderMarketingAttribution_source_idx" ON "OrderMarketingAttribution"("source", "campaign")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrganizationMarketingSettings" ("organizationId" TEXT PRIMARY KEY, "metaPixelId" TEXT, "googleAnalyticsId" TEXT, "googleAdsId" TEXT, "tiktokPixelId" TEXT, "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

    // Marketing permissions are deliberately separate from orders and tickets.
    // Revoking marketing never deletes or changes purchase history.
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketingConsent" ("id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "guestId" TEXT NOT NULL, "channel" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'UNKNOWN', "purpose" TEXT NOT NULL DEFAULT 'MARKETING', "source" TEXT NOT NULL, "consentTextVersion" TEXT NOT NULL, "proofJson" TEXT, "grantedAt" TIMESTAMP, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MarketingConsent_scope_key" ON "MarketingConsent"("organizationId", "guestId", "channel", "purpose")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketingConsent_status_idx" ON "MarketingConsent"("organizationId", "channel", "status")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketingSuppression" ("id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "guestId" TEXT NOT NULL, "channel" TEXT, "scope" TEXT NOT NULL DEFAULT 'ORGANIZER_MARKETING', "reason" TEXT NOT NULL, "source" TEXT NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "releasedAt" TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketingSuppression_guest_idx" ON "MarketingSuppression"("organizationId", "guestId")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketingSuppression_active_idx" ON "MarketingSuppression"("organizationId", "channel", "releasedAt")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketingCampaign" ("id" TEXT PRIMARY KEY, "organizationId" TEXT NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL DEFAULT 'MARKETING', "status" TEXT NOT NULL DEFAULT 'DRAFT', "channel" TEXT NOT NULL, "segmentJson" TEXT NOT NULL, "contentJson" TEXT NOT NULL, "estimatedRecipients" INTEGER NOT NULL DEFAULT 0, "estimatedCostMinor" INTEGER NOT NULL DEFAULT 0, "reservedCostMinor" INTEGER NOT NULL DEFAULT 0, "scheduledAt" TIMESTAMP, "createdById" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketingCampaign_status_idx" ON "MarketingCampaign"("organizationId", "status", "createdAt")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "MarketingCampaignRecipient" ("id" TEXT PRIMARY KEY, "campaignId" TEXT NOT NULL, "guestId" TEXT NOT NULL, "channel" TEXT NOT NULL, "contactValue" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'SNAPSHOT', "exclusionReason" TEXT, "consentSource" TEXT, "consentGrantedAt" TIMESTAMP, "unitCostMinor" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaignRecipient_scope_key" ON "MarketingCampaignRecipient"("campaignId", "guestId", "channel")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MarketingCampaignRecipient_status_idx" ON "MarketingCampaignRecipient"("campaignId", "status")`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CommunicationRate" ("id" TEXT PRIMARY KEY, "organizationId" TEXT, "channel" TEXT NOT NULL, "countryCode" TEXT NOT NULL DEFAULT 'IL', "providerCostMinor" INTEGER NOT NULL, "atlasMarkupMinor" INTEGER NOT NULL DEFAULT 0, "currency" TEXT NOT NULL DEFAULT 'ILS', "activeFrom" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "activeTo" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommunicationRate_active_idx" ON "CommunicationRate"("organizationId", "channel", "activeFrom")`);
  })();
  return ready;
}

export type MarketingAttribution = { sessionId?: string | null; source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null; term?: string | null; landingPath?: string | null };

type RawExecutor = { $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number> };

export function parseMarketingCookie(cookieHeader: string | null): MarketingAttribution | null {
  if (!cookieHeader) return null;
  const pair = cookieHeader.split(";").map((item) => item.trim()).find((item) => item.startsWith("atlas_marketing="));
  if (!pair) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(pair.slice("atlas_marketing=".length))) as MarketingAttribution;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch { return null; }
}

export async function saveOrderAttribution(executor: RawExecutor, orderId: string, attribution: MarketingAttribution | null) {
  if (!attribution) return;
  await executor.$executeRawUnsafe(`INSERT INTO "OrderMarketingAttribution" ("id", "orderId", "sessionId", "source", "medium", "campaign", "content", "term", "landingPath", "createdAt") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP) ON CONFLICT ("orderId") DO UPDATE SET "sessionId"=EXCLUDED."sessionId", "source"=EXCLUDED."source", "medium"=EXCLUDED."medium", "campaign"=EXCLUDED."campaign", "content"=EXCLUDED."content", "term"=EXCLUDED."term", "landingPath"=EXCLUDED."landingPath", "createdAt"=CURRENT_TIMESTAMP`, crypto.randomUUID(), orderId, attribution.sessionId ?? null, attribution.source ?? null, attribution.medium ?? null, attribution.campaign ?? null, attribution.content ?? null, attribution.term ?? null, attribution.landingPath ?? null);
}
