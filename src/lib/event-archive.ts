import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

export function ensureEventArchiveRuntime() {
  ready ??= (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS EventArchiveState (
      eventId TEXT PRIMARY KEY,
      archivedAt TEXT NOT NULL,
      archivedById TEXT,
      previousStatus TEXT NOT NULL DEFAULT 'DRAFT'
    )`);
  })();
  return ready;
}

export async function isEventArchived(eventId: string) {
  await ensureEventArchiveRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ eventId: string }>>(
    `SELECT eventId FROM EventArchiveState WHERE eventId=? LIMIT 1`,
    eventId,
  );
  return rows.length > 0;
}
