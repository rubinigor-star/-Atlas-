import { randomUUID } from "crypto";
import { db } from "@/lib/db";

type SqlExecutor = Pick<typeof db, "$executeRaw" | "$queryRaw">;

export type ReservationStatus = "ACTIVE" | "COMMITTED" | "RELEASED" | "EXPIRED";

export type ReservationItemInput = {
  categoryId: string;
  quantity: number;
  tableId?: string | null;
  seatId?: string | null;
};

async function releaseClaims(reservationId: string, executor: SqlExecutor) {
  await executor.$executeRaw`
    DELETE FROM ReservationClaim WHERE reservationId = ${reservationId}
  `;
}

export async function expireReservations(executor: SqlExecutor = db) {
  const expired = await executor.$queryRaw<Array<{ id: string; orderId: string }>>`
    SELECT id, orderId
    FROM Reservation
    WHERE status = 'ACTIVE' AND expiresAt <= CURRENT_TIMESTAMP
  `;

  for (const reservation of expired) {
    await executor.$executeRaw`
      UPDATE PaymentAuthorization
      SET status = 'VOIDED', voidedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
      WHERE orderId = ${reservation.orderId} AND status = 'AUTHORIZED'
    `;
    await executor.$executeRaw`
      UPDATE "Order"
      SET status = 'CANCELLED', reviewNote = 'Срок временного резерва истёк', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${reservation.orderId} AND status = 'PENDING_APPROVAL'
    `;
    const changed = await executor.$executeRaw`
      UPDATE Reservation
      SET status = 'EXPIRED', updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${reservation.id} AND status = 'ACTIVE'
    `;
    if (changed === 1) await releaseClaims(reservation.id, executor);
  }

  return expired.length;
}

export async function assertInventoryAvailable(params: {
  items: ReservationItemInput[];
  capacities: Map<string, { sold: number; capacity: number; name: string }>;
  executor?: SqlExecutor;
}) {
  const executor = params.executor ?? db;
  await expireReservations(executor);

  const requestedByCategory = new Map<string, number>();
  for (const item of params.items) {
    requestedByCategory.set(item.categoryId, (requestedByCategory.get(item.categoryId) ?? 0) + item.quantity);
  }

  for (const [categoryId, requestedQuantity] of requestedByCategory) {
    const category = params.capacities.get(categoryId);
    if (!category) throw new Error("Категория билета не найдена");

    await executor.$executeRaw`
      INSERT OR IGNORE INTO ReservationInventoryLock (categoryId, updatedAt)
      VALUES (${categoryId}, CURRENT_TIMESTAMP)
    `;
    await executor.$executeRaw`
      UPDATE ReservationInventoryLock
      SET updatedAt = CURRENT_TIMESTAMP
      WHERE categoryId = ${categoryId}
    `;

    const reservedRows = await executor.$queryRaw<Array<{ quantity: number | bigint | null }>>`
      SELECT COALESCE(SUM(ri.quantity), 0) AS quantity
      FROM ReservationItem ri
      JOIN Reservation r ON r.id = ri.reservationId
      WHERE ri.categoryId = ${categoryId} AND r.status = 'ACTIVE'
    `;
    const reserved = Number(reservedRows[0]?.quantity ?? 0);
    if (category.sold + reserved + requestedQuantity > category.capacity) {
      throw new Error(`Недостаточно доступных билетов ${category.name}`);
    }
  }

  for (const item of params.items) {
    if (item.tableId) {
      const conflicts = await executor.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(*) AS count FROM ReservationClaim WHERE tableId = ${item.tableId}
      `;
      if (Number(conflicts[0]?.count ?? 0) > 0) throw new Error("Этот стол уже временно забронирован");
    }

    if (item.seatId) {
      const conflicts = await executor.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(*) AS count FROM ReservationClaim WHERE seatId = ${item.seatId}
      `;
      if (Number(conflicts[0]?.count ?? 0) > 0) throw new Error("Это место уже временно забронировано");
    }
  }
}

export async function createReservation(params: {
  orderId: string;
  items: ReservationItemInput[];
  ttlMinutes?: number;
  executor?: SqlExecutor;
}) {
  const executor = params.executor ?? db;
  const existing = await executor.$queryRaw<Array<{ id: string; status: ReservationStatus; expiresAt: Date }>>`
    SELECT id, status, expiresAt FROM Reservation WHERE orderId = ${params.orderId} LIMIT 1
  `;
  if (existing[0]) return existing[0];

  const id = `res_${randomUUID().replace(/-/g, "")}`;
  const expiresAt = new Date(Date.now() + (params.ttlMinutes ?? 30) * 60 * 1000);
  await executor.$executeRaw`
    INSERT INTO Reservation (id, orderId, status, expiresAt, createdAt, updatedAt)
    VALUES (${id}, ${params.orderId}, 'ACTIVE', ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  try {
    for (const item of params.items) {
      const itemId = `resi_${randomUUID().replace(/-/g, "")}`;
      await executor.$executeRaw`
        INSERT INTO ReservationItem (id, reservationId, categoryId, quantity, tableId, seatId, createdAt)
        VALUES (${itemId}, ${id}, ${item.categoryId}, ${item.quantity}, ${item.tableId ?? null}, ${item.seatId ?? null}, CURRENT_TIMESTAMP)
      `;

      if (item.tableId || item.seatId) {
        const claimId = `resc_${randomUUID().replace(/-/g, "")}`;
        await executor.$executeRaw`
          INSERT INTO ReservationClaim (id, reservationId, tableId, seatId, createdAt)
          VALUES (${claimId}, ${id}, ${item.tableId ?? null}, ${item.seatId ?? null}, CURRENT_TIMESTAMP)
        `;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("ReservationClaim_tableId_key") || message.includes("ReservationClaim.tableId")) {
      throw new Error("Этот стол только что был временно забронирован другим покупателем");
    }
    if (message.includes("ReservationClaim_seatId_key") || message.includes("ReservationClaim.seatId")) {
      throw new Error("Это место только что было временно забронировано другим покупателем");
    }
    throw error;
  }

  return { id, status: "ACTIVE" as const, expiresAt };
}

export async function commitReservation(orderId: string, executor: SqlExecutor = db) {
  await expireReservations(executor);
  const rows = await executor.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Reservation WHERE orderId = ${orderId} AND status = 'ACTIVE' LIMIT 1
  `;
  const reservation = rows[0];
  if (!reservation) throw new Error("Резерв не найден или уже истёк");

  const updated = await executor.$executeRaw`
    UPDATE Reservation
    SET status = 'COMMITTED', committedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${reservation.id} AND status = 'ACTIVE'
  `;
  if (updated !== 1) throw new Error("Резерв был изменён другой операцией");
  await releaseClaims(reservation.id, executor);
}

export async function releaseReservation(orderId: string, executor: SqlExecutor = db) {
  const rows = await executor.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Reservation WHERE orderId = ${orderId} AND status = 'ACTIVE' LIMIT 1
  `;
  const reservation = rows[0];
  if (!reservation) return;

  const updated = await executor.$executeRaw`
    UPDATE Reservation
    SET status = 'RELEASED', releasedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${reservation.id} AND status = 'ACTIVE'
  `;
  if (updated === 1) await releaseClaims(reservation.id, executor);
}
