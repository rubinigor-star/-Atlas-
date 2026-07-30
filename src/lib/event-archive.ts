import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

function isPostgresRuntime() {
  const url = process.env.POSTGRES_PRISMA_URL ?? process.env.DATABASE_URL ?? "";
  return url.startsWith("postgresql://") || url.startsWith("postgres://");
}

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
  const sql = isPostgresRuntime()
    ? `SELECT eventId FROM EventArchiveState WHERE eventId=$1 LIMIT 1`
    : `SELECT eventId FROM EventArchiveState WHERE eventId=? LIMIT 1`;
  const rows = await db.$queryRawUnsafe<Array<{ eventId: string }>>(sql, eventId);
  return rows.length > 0;
}

export function archiveInsertSql() {
  return isPostgresRuntime()
    ? `INSERT INTO EventArchiveState (eventId,archivedAt,archivedById,previousStatus) VALUES ($1,$2,$3,$4)`
    : `INSERT INTO EventArchiveState (eventId,archivedAt,archivedById,previousStatus) VALUES (?,?,?,?)`;
}

export function archiveDeleteSql() {
  return isPostgresRuntime()
    ? `DELETE FROM EventArchiveState WHERE eventId=$1`
    : `DELETE FROM EventArchiveState WHERE eventId=?`;
}
