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

export async function expireReservations(executor: SqlExecutor = db) {
  await executor.$executeRaw`
    UPDATE Reservation
    SET status = 'EXPIRED', updatedAt = CURRENT_TIMESTAMP
    WHERE status = 'ACTIVE' AND expiresAt <= CURRENT_TIMESTAMP
  `;
}

export async function assertInventoryAvailable(params: {
  items: ReservationItemInput[];
  capacities: Map<string, { sold: number; capacity: number; name: string }>;
  executor?: SqlExecutor;
}) {
  const executor = params.executor ?? db;
  await expireReservations(executor);

  for (const item of params.items) {
    const category = params.capacities.get(item.categoryId);
    if (!category) throw new Error("Категория билета не найдена");

    const reservedRows = await executor.$queryRaw<Array<{ quantity: number | bigint | null }>>`
      SELECT COALESCE(SUM(ri.quantity), 0) AS quantity
      FROM ReservationItem ri
      JOIN Reservation r ON r.id = ri.reservationId
      WHERE ri.categoryId = ${item.categoryId} AND r.status = 'ACTIVE'
    `;
    const reserved = Number(reservedRows[0]?.quantity ?? 0);
    if (category.sold + reserved + item.quantity > category.capacity) {
      throw new Error(`Недостаточно доступных билетов ${category.name}`);
    }

    if (item.tableId) {
      const conflicts = await executor.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(*) AS count
        FROM ReservationItem ri
        JOIN Reservation r ON r.id = ri.reservationId
        WHERE ri.tableId = ${item.tableId} AND r.status = 'ACTIVE'
      `;
      if (Number(conflicts[0]?.count ?? 0) > 0) throw new Error("Этот стол уже временно забронирован");
    }

    if (item.seatId) {
      const conflicts = await executor.$queryRaw<Array<{ count: number | bigint }>>`
        SELECT COUNT(*) AS count
        FROM ReservationItem ri
        JOIN Reservation r ON r.id = ri.reservationId
        WHERE ri.seatId = ${item.seatId} AND r.status = 'ACTIVE'
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

  for (const item of params.items) {
    const itemId = `resi_${randomUUID().replace(/-/g, "")}`;
    await executor.$executeRaw`
      INSERT INTO ReservationItem (id, reservationId, categoryId, quantity, tableId, seatId, createdAt)
      VALUES (${itemId}, ${id}, ${item.categoryId}, ${item.quantity}, ${item.tableId ?? null}, ${item.seatId ?? null}, CURRENT_TIMESTAMP)
    `;
  }

  return { id, status: "ACTIVE" as const, expiresAt };
}

export async function commitReservation(orderId: string, executor: SqlExecutor = db) {
  await expireReservations(executor);
  const updated = await executor.$executeRaw`
    UPDATE Reservation
    SET status = 'COMMITTED', committedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE orderId = ${orderId} AND status = 'ACTIVE'
  `;
  if (updated !== 1) throw new Error("Резерв не найден или уже истёк");
}

export async function releaseReservation(orderId: string, executor: SqlExecutor = db) {
  await executor.$executeRaw`
    UPDATE Reservation
    SET status = 'RELEASED', releasedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE orderId = ${orderId} AND status = 'ACTIVE'
  `;
}
