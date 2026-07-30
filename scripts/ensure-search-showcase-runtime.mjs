import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const LIMIT = 8;

try {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "SearchShowcaseEvent" (
    "eventId" TEXT PRIMARY KEY,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
  )`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SearchShowcaseEvent_position_idx" ON "SearchShowcaseEvent"("position")`);

  const [{ count }] = await db.$queryRawUnsafe(`SELECT COUNT(*) AS "count" FROM "SearchShowcaseEvent"`);
  if (Number(count ?? 0) === 0) {
    const events = await db.event.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { startsAt: "asc" },
      take: LIMIT,
      select: { id: true },
    });

    for (const [index, event] of events.entries()) {
      await db.$executeRawUnsafe(
        `INSERT INTO "SearchShowcaseEvent" ("eventId", "position", "createdAt") VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT ("eventId") DO NOTHING`,
        event.id,
        index + 1,
      );
    }
  }

  console.log("Search showcase runtime table is ready.");
} finally {
  await db.$disconnect();
}
