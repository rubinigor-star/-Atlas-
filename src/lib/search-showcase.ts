import { db } from "@/lib/db";

export const SEARCH_SHOWCASE_LIMIT = 8;

export type SearchShowcaseEvent = {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  city: string;
  startsAt: Date;
};

let searchShowcaseTablePromise: Promise<void> | null = null;

export function ensureSearchShowcaseTable() {
  if (!searchShowcaseTablePromise) {
    searchShowcaseTablePromise = db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SearchShowcaseEvent" (
      "eventId" TEXT PRIMARY KEY,
      "position" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
    )`).then(() => undefined).catch(error => {
      searchShowcaseTablePromise = null;
      throw error;
    });
  }
  return searchShowcaseTablePromise;
}

export async function getSearchShowcaseEventIds() {
  await ensureSearchShowcaseTable();
  const rows = await db.$queryRaw<Array<{ eventId: string }>>`
    SELECT "eventId" FROM "SearchShowcaseEvent" ORDER BY "position" ASC, "createdAt" ASC
  `;
  return rows.map(row => row.eventId);
}

export async function getSearchShowcaseEvents(): Promise<SearchShowcaseEvent[]> {
  const ids = await getSearchShowcaseEventIds();
  if (!ids.length) return [];

  const events = await db.event.findMany({
    where: { id: { in: ids }, status: "PUBLISHED" },
    select: {
      id: true,
      slug: true,
      title: true,
      posterUrl: true,
      startsAt: true,
      venue: { select: { city: true } },
    },
  });
  const byId = new Map(events.map(event => [event.id, event]));

  return ids.flatMap(id => {
    const event = byId.get(id);
    return event ? [{
      id: event.id,
      slug: event.slug,
      title: event.title,
      posterUrl: event.posterUrl,
      city: event.venue.city,
      startsAt: event.startsAt,
    }] : [];
  });
}

export async function setSearchShowcaseEvent(eventId: string, featured: boolean) {
  await ensureSearchShowcaseTable();

  if (!featured) {
    await db.$executeRaw`DELETE FROM "SearchShowcaseEvent" WHERE "eventId" = ${eventId}`;
    return;
  }

  const event = await db.event.findUnique({ where: { id: eventId }, select: { status: true } });
  if (!event || event.status !== "PUBLISHED") throw new Error("Only published events can be featured in search.");

  const existing = await db.$queryRaw<Array<{ eventId: string }>>`
    SELECT "eventId" FROM "SearchShowcaseEvent" WHERE "eventId" = ${eventId}
  `;
  if (existing.length) return;

  const countRows = await db.$queryRaw<Array<{ count: number | bigint }>>`
    SELECT COUNT(*) AS "count" FROM "SearchShowcaseEvent"
  `;
  if (Number(countRows[0]?.count ?? 0) >= SEARCH_SHOWCASE_LIMIT) {
    throw new Error(`A maximum of ${SEARCH_SHOWCASE_LIMIT} featured search events is allowed.`);
  }

  const positionRows = await db.$queryRaw<Array<{ next: number | bigint }>>`
    SELECT COALESCE(MAX("position"), 0) + 1 AS "next" FROM "SearchShowcaseEvent"
  `;
  const position = Number(positionRows[0]?.next ?? 1);

  await db.$executeRaw`
    INSERT INTO "SearchShowcaseEvent" ("eventId", "position", "createdAt")
    VALUES (${eventId}, ${position}, CURRENT_TIMESTAMP)
    ON CONFLICT ("eventId") DO NOTHING
  `;
}
