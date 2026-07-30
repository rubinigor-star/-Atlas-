import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

export function ensureMarketingRuntime() {
  if (!ready) ready = (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS MarketingVisit (id TEXT PRIMARY KEY, sessionId TEXT NOT NULL, eventId TEXT, source TEXT, medium TEXT, campaign TEXT, content TEXT, term TEXT, landingPath TEXT, referrer TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS MarketingVisit_session_idx ON MarketingVisit(sessionId, createdAt)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS MarketingVisit_event_idx ON MarketingVisit(eventId, createdAt)`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS OrderMarketingAttribution (id TEXT PRIMARY KEY, orderId TEXT NOT NULL UNIQUE, sessionId TEXT, source TEXT, medium TEXT, campaign TEXT, content TEXT, term TEXT, landingPath TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS OrderMarketingAttribution_source_idx ON OrderMarketingAttribution(source, campaign)`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS OrganizationMarketingSettings (organizationId TEXT PRIMARY KEY, metaPixelId TEXT, googleAnalyticsId TEXT, googleAdsId TEXT, tiktokPixelId TEXT, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
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
  await executor.$executeRawUnsafe(`INSERT OR REPLACE INTO OrderMarketingAttribution (id, orderId, sessionId, source, medium, campaign, content, term, landingPath, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, crypto.randomUUID(), orderId, attribution.sessionId ?? null, attribution.source ?? null, attribution.medium ?? null, attribution.campaign ?? null, attribution.content ?? null, attribution.term ?? null, attribution.landingPath ?? null);
}
