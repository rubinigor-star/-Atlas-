import { db } from "@/lib/db";

let runtimeReady: Promise<void> | undefined;

export function ensureCartCheckoutOwnerRuntime() {
  runtimeReady ??= (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CartCheckoutOwner" (
      "sessionId" TEXT NOT NULL,
      "eventId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("sessionId","eventId")
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CartCheckoutOwner_orderId_idx" ON "CartCheckoutOwner"("orderId")`);
  })().catch((error) => {
    runtimeReady = undefined;
    throw error;
  });
  return runtimeReady;
}

export async function rememberPendingCheckoutOwner(params: { sessionId: string; orderPublicId: string }) {
  await ensureCartCheckoutOwnerRuntime();
  const order = await db.order.findUnique({ where: { publicId: params.orderPublicId }, select: { id: true, eventId: true, status: true } });
  if (!order || order.status !== "PENDING") return null;
  await db.$executeRawUnsafe(
    `INSERT INTO "CartCheckoutOwner" ("sessionId","eventId","orderId","createdAt","updatedAt") VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("sessionId","eventId") DO UPDATE SET "orderId"=EXCLUDED."orderId","updatedAt"=CURRENT_TIMESTAMP`,
    params.sessionId,
    order.eventId,
    order.id,
  );
  return { orderId: order.id, eventId: order.eventId };
}

export async function getPendingCheckoutOwner(sessionId: string, eventId: string) {
  await ensureCartCheckoutOwnerRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ orderId: string; expiresAt: Date | null }>>(
    `SELECT c."orderId", r."expiresAt"
     FROM "CartCheckoutOwner" c
     JOIN "Order" o ON o."id"=c."orderId"
     LEFT JOIN "Reservation" r ON r."orderId"=c."orderId" AND r."status"='ACTIVE' AND r."expiresAt">CURRENT_TIMESTAMP
     WHERE c."sessionId"=$1 AND c."eventId"=$2 AND o."status"='PENDING'
     ORDER BY c."updatedAt" DESC LIMIT 1`,
    sessionId,
    eventId,
  );
  return rows[0] ?? null;
}

export async function pendingCheckoutReservationMatches(orderId: string, items: Array<{ categoryId: string; quantity: number; tableId?: string | null; seatId?: string | null }>) {
  const rows = await db.$queryRawUnsafe<Array<{ categoryId: string; quantity: number | bigint; tableId: string | null; seatId: string | null }>>(
    `SELECT ri."categoryId",ri."quantity",ri."tableId",ri."seatId"
     FROM "ReservationItem" ri JOIN "Reservation" r ON r."id"=ri."reservationId"
     WHERE r."orderId"=$1 AND r."status"='ACTIVE' AND r."expiresAt">CURRENT_TIMESTAMP`,
    orderId,
  );
  const normalize = (value: Array<{ categoryId: string; quantity: number | bigint; tableId?: string | null; seatId?: string | null }>) => value
    .map((item) => `${item.categoryId}|${Number(item.quantity)}|${item.tableId ?? ""}|${item.seatId ?? ""}`)
    .sort();
  const left = normalize(rows);
  const right = normalize(items);
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
