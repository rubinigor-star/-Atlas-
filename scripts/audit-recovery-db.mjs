import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

function safe(value) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

function posterSummary(value) {
  const poster = String(value ?? '');
  return {
    kind: poster.startsWith('data:') ? 'data-url' : poster.startsWith('http') ? 'remote-url' : poster.startsWith('/') ? 'local-path' : 'other',
    length: poster.length,
    preview: poster.startsWith('data:') ? poster.slice(0, 40) : poster,
  };
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
    LEFT JOIN "Ticket" t ON t."orderId" = o.id
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

  const normalized = events.map((row) => ({
    ...Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'posterUrl').map(([key, value]) => [key, safe(value)])),
    poster: posterSummary(row.posterUrl),
  }));

  const output = {
    marker: 'ATLAS_DB_RECOVERY_AUDIT_V2',
    generatedAt: new Date().toISOString(),
    counts: counts[0] ?? {},
    events: normalized,
  };

  console.log(JSON.stringify(output));
} finally {
  await db.$disconnect();
}
