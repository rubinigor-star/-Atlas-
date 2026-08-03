import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function safe(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

try {
  const events = await db.$queryRawUnsafe(`
    SELECT
      e.id,
      e.slug,
      e.title,
      e.status,
      e."posterUrl",
      e."startsAt",
      e."createdAt",
      e."updatedAt",
      COUNT(DISTINCT o.id)::int AS "orderCount",
      COUNT(DISTINCT t.id)::int AS "ticketCount"
    FROM "Event" e
    LEFT JOIN "Order" o ON o."eventId" = e.id
    LEFT JOIN "Ticket" t ON t."eventId" = e.id
    GROUP BY e.id
    ORDER BY e."createdAt" DESC, e.title ASC
  `);

  const counts = await db.$queryRawUnsafe(`
    SELECT
      (SELECT COUNT(*)::int FROM "Event") AS events,
      (SELECT COUNT(*)::int FROM "Order") AS orders,
      (SELECT COUNT(*)::int FROM "Ticket") AS tickets,
      (SELECT COUNT(*)::int FROM "User") AS users
  `);

  const output = {
    marker: 'ATLAS_DB_RECOVERY_AUDIT_V1',
    generatedAt: new Date().toISOString(),
    counts: counts[0] ?? {},
    events: events.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, safe(value)]))),
  };

  console.log(JSON.stringify(output));
} finally {
  await db.$disconnect();
}
