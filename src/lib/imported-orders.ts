import { db } from "@/lib/db";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";
import { ensureExternalCustomerProfileColumns } from "@/lib/external-customer-profiles";

export type ImportedOrderRow = {
  key: string;
  externalOrderId: string | null;
  eventId: string;
  eventTitle: string;
  startsAt: Date | string;
  sourceName: string;
  platformKey: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerCount: number;
  ticketCount: number;
  totalMinor: number;
  currency: string;
  createdAt: Date | string;
  usedCount: number;
  cancelledCount: number;
};

type CountRow = { count: bigint | number | string };

function scopeClause(eventIds?: string[]) {
  if (!eventIds) return { sql: "", params: [] as unknown[] };
  if (!eventIds.length) return { sql: ` AND 1=0`, params: [] as unknown[] };
  const placeholders = eventIds.map((_, index) => `$${index + 2}`).join(",");
  return { sql: ` AND t."eventId" IN (${placeholders})`, params: eventIds };
}

export async function getImportedOrders({ organizationId, eventIds, page = 1, pageSize = 25 }: { organizationId: string; eventIds?: string[]; page?: number; pageSize?: number }) {
  await ensureExternalTicketStorage();
  await ensureExternalCustomerProfileColumns();
  const scope = scopeClause(eventIds);
  const baseParams: unknown[] = [organizationId, ...scope.params];
  const orderKey = `COALESCE(NULLIF(t."externalOrderId",''),t."externalTicketId")`;
  const countRows = await db.$queryRawUnsafe<CountRow[]>(
    `SELECT COUNT(*) AS "count" FROM (
       SELECT t."sourceId",t."eventId",${orderKey} AS "orderKey"
       FROM "ExternalTicket" t
       JOIN "Event" e ON e."id"=t."eventId"
       WHERE e."organizationId"=$1${scope.sql}
       GROUP BY t."sourceId",t."eventId",${orderKey}
     ) q`,
    ...baseParams,
  );
  const total = Number(countRows[0]?.count || 0);
  const offset = Math.max(0, page - 1) * pageSize;
  const limitParam = baseParams.length + 1;
  const offsetParam = baseParams.length + 2;
  const rows = await db.$queryRawUnsafe<ImportedOrderRow[]>(
    `SELECT
       (t."sourceId"||':'||t."eventId"||':'||${orderKey}) AS "key",
       NULLIF(t."externalOrderId",'') AS "externalOrderId",
       t."eventId",e."title" AS "eventTitle",e."startsAt",s."name" AS "sourceName",s."platformKey",
       MIN(NULLIF(t."holderName",'')) AS "customerName",
       MIN(NULLIF(t."phone",'')) AS "customerPhone",
       MIN(NULLIF(t."email",'')) AS "customerEmail",
       COUNT(DISTINCT COALESCE(t."customerId",NULLIF(regexp_replace(COALESCE(t."phone",''),'\\D','','g'),'')))::int AS "customerCount",
       COUNT(*)::int AS "ticketCount",
       COALESCE(SUM(t."priceMinor"),0)::int AS "totalMinor",
       MIN(t."currency") AS "currency",
       MIN(t."createdAt") AS "createdAt",
       COUNT(*) FILTER (WHERE t."status"='USED')::int AS "usedCount",
       COUNT(*) FILTER (WHERE t."status"='CANCELLED')::int AS "cancelledCount"
     FROM "ExternalTicket" t
     JOIN "ExternalTicketSource" s ON s."id"=t."sourceId"
     JOIN "Event" e ON e."id"=t."eventId"
     WHERE e."organizationId"=$1${scope.sql}
     GROUP BY t."sourceId",t."eventId",e."title",e."startsAt",s."name",s."platformKey",${orderKey},t."externalOrderId"
     ORDER BY MIN(t."createdAt") DESC
     LIMIT $${limitParam} OFFSET $${offsetParam}`,
    ...baseParams,
    pageSize,
    offset,
  );
  return { total, rows };
}
