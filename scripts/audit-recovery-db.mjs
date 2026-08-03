import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

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

  const orders = await db.$queryRawUnsafe(`
    SELECT o."publicId", o.status, o."totalMinor", o."createdAt", o."eventId", e.slug, e.title
    FROM "Order" o
    JOIN "Event" e ON e.id = o."eventId"
    ORDER BY o."createdAt" DESC
  `);

  const auditLogs = await db.$queryRawUnsafe(`
    SELECT id, action, "entityType", "entityId", summary, metadata, "createdAt"
    FROM "AuditLog"
    WHERE "entityType" = 'Event' OR action ILIKE '%event%'
    ORDER BY "createdAt" DESC
    LIMIT 200
  `);

  console.log(`ATLAS_DB_RECOVERY_COUNTS ${JSON.stringify(counts[0] ?? {})}`);
  for (const row of events) {
    console.log(`ATLAS_DB_RECOVERY_EVENT ${JSON.stringify({
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      startsAt: row.startsAt instanceof Date ? row.startsAt.toISOString() : row.startsAt,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
      orderCount: row.orderCount,
      ticketCount: row.ticketCount,
      poster: posterSummary(row.posterUrl),
    })}`);
  }
  for (const row of orders) {
    console.log(`ATLAS_DB_RECOVERY_ORDER ${JSON.stringify({
      publicId: row.publicId,
      status: row.status,
      totalMinor: row.totalMinor,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
      eventId: row.eventId,
      slug: row.slug,
      title: row.title,
    })}`);
  }
  for (const row of auditLogs) {
    console.log(`ATLAS_DB_RECOVERY_AUDITLOG ${JSON.stringify({
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      metadata: row.metadata,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    })}`);
  }
} finally {
  await db.$disconnect();
}
