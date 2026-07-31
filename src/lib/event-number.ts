import { db } from "@/lib/db";

let ensured = false;

async function ensureRuntime() {
  if (ensured) return;
  await db.$executeRawUnsafe(`CREATE SEQUENCE IF NOT EXISTS atlas_event_number_seq START 1`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "EventNumber" (
    "eventId" TEXT PRIMARY KEY,
    "sequence" BIGINT NOT NULL UNIQUE DEFAULT nextval('atlas_event_number_seq'),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  ensured = true;
}

export function formatEventNumber(sequence: bigint | number) {
  return `AT-${String(sequence).padStart(6, "0")}`;
}

export async function getEventNumber(eventId: string) {
  await ensureRuntime();
  await db.$executeRawUnsafe(
    `INSERT INTO "EventNumber" ("eventId") VALUES ($1) ON CONFLICT ("eventId") DO NOTHING`,
    eventId,
  );
  const rows = await db.$queryRawUnsafe<Array<{ sequence: bigint }>>(
    `SELECT "sequence" FROM "EventNumber" WHERE "eventId" = $1 LIMIT 1`,
    eventId,
  );
  return formatEventNumber(rows[0].sequence);
}

export async function getEventNumbers(eventIds: string[]) {
  await ensureRuntime();
  for (const eventId of eventIds) {
    await db.$executeRawUnsafe(
      `INSERT INTO "EventNumber" ("eventId") VALUES ($1) ON CONFLICT ("eventId") DO NOTHING`,
      eventId,
    );
  }
  if (!eventIds.length) return new Map<string, string>();
  const rows = await db.$queryRawUnsafe<Array<{ eventId: string; sequence: bigint }>>(
    `SELECT "eventId", "sequence" FROM "EventNumber" WHERE "eventId" = ANY($1::text[])`,
    eventIds,
  );
  return new Map(rows.map((row) => [row.eventId, formatEventNumber(row.sequence)]));
}
