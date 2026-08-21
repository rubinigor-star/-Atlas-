import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { assertInventoryAvailable, expireReservations, type ReservationItemInput } from "@/lib/reservation";

type SqlExecutor = Pick<typeof db, "$executeRaw" | "$queryRaw">;

export const CART_SESSION_COOKIE = "atlas_cart_session";
export const CART_HOLD_TTL_MINUTES = 15;

export function cartHoldOrderId(sessionId: string, eventId: string) {
  return `cart:${sessionId}:${eventId}`;
}

async function removeReservationItems(reservationId: string, executor: SqlExecutor) {
  await executor.$executeRaw`DELETE FROM ReservationClaim WHERE reservationId = ${reservationId}`;
  await executor.$executeRaw`DELETE FROM ReservationItem WHERE reservationId = ${reservationId}`;
}

async function insertReservationItems(reservationId: string, items: ReservationItemInput[], executor: SqlExecutor) {
  for (const item of items) {
    const itemId = `resi_${randomUUID().replace(/-/g, "")}`;
    await executor.$executeRaw`
      INSERT INTO ReservationItem (id, reservationId, categoryId, quantity, tableId, seatId, createdAt)
      VALUES (${itemId}, ${reservationId}, ${item.categoryId}, ${item.quantity}, ${item.tableId ?? null}, ${item.seatId ?? null}, CURRENT_TIMESTAMP)
    `;
    if (item.tableId || item.seatId) {
      const claimId = `resc_${randomUUID().replace(/-/g, "")}`;
      await executor.$executeRaw`
        INSERT INTO ReservationClaim (id, reservationId, tableId, seatId, createdAt)
        VALUES (${claimId}, ${reservationId}, ${item.tableId ?? null}, ${item.seatId ?? null}, CURRENT_TIMESTAMP)
      `;
    }
  }
}

function normalizeClaimError(error: unknown): never {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("ReservationClaim_tableId_key") || message.includes("ReservationClaim.tableId") || message.includes("UNIQUE constraint failed: ReservationClaim.tableId")) {
    throw new Error("Этот стол только что был временно забронирован другим покупателем");
  }
  if (message.includes("ReservationClaim_seatId_key") || message.includes("ReservationClaim.seatId") || message.includes("UNIQUE constraint failed: ReservationClaim.seatId")) {
    throw new Error("Это место только что было временно забронировано другим покупателем");
  }
  throw error;
}

export async function replaceCartHold(params: {
  sessionId: string;
  eventId: string;
  items: ReservationItemInput[];
  capacities: Map<string, { sold: number; capacity: number; name: string }>;
  executor?: SqlExecutor;
}) {
  const executor = params.executor ?? db;
  await expireReservations(executor);
  const orderId = cartHoldOrderId(params.sessionId, params.eventId);
  const rows = await executor.$queryRaw<Array<{ id: string; status: string; expiresAt: Date }>>`
    SELECT id, status, expiresAt FROM Reservation WHERE orderId = ${orderId} LIMIT 1
  `;
  const existing = rows[0];
  const existingId = existing?.id;

  if (existingId) await removeReservationItems(existingId, executor);

  if (!params.items.length) {
    if (existingId) {
      await executor.$executeRaw`
        UPDATE Reservation
        SET status = 'RELEASED', releasedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
        WHERE id = ${existingId}
      `;
    }
    return null;
  }

  await assertInventoryAvailable({ items: params.items, capacities: params.capacities, executor });

  const previousExpiry = existing?.status === "ACTIVE" && new Date(existing.expiresAt).getTime() > Date.now()
    ? new Date(existing.expiresAt)
    : null;
  const expiresAt = previousExpiry ?? new Date(Date.now() + CART_HOLD_TTL_MINUTES * 60 * 1000);
  const reservationId = existingId ?? `res_${randomUUID().replace(/-/g, "")}`;
  if (existingId) {
    await executor.$executeRaw`
      UPDATE Reservation
      SET status = 'ACTIVE', expiresAt = ${expiresAt}, committedAt = NULL, releasedAt = NULL, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ${existingId}
    `;
  } else {
    await executor.$executeRaw`
      INSERT INTO Reservation (id, orderId, status, expiresAt, createdAt, updatedAt)
      VALUES (${reservationId}, ${orderId}, 'ACTIVE', ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
  }

  try {
    await insertReservationItems(reservationId, params.items, executor);
  } catch (error) {
    normalizeClaimError(error);
  }

  return { id: reservationId, orderId, expiresAt };
}

export async function releaseCartHold(params: {
  sessionId: string;
  eventId: string;
  executor?: SqlExecutor;
}) {
  const executor = params.executor ?? db;
  await expireReservations(executor);
  const orderId = cartHoldOrderId(params.sessionId, params.eventId);
  const rows = await executor.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Reservation WHERE orderId = ${orderId} AND status = 'ACTIVE' LIMIT 1
  `;
  const id = rows[0]?.id;
  if (!id) return false;
  await removeReservationItems(id, executor);
  await executor.$executeRaw`
    UPDATE Reservation
    SET status = 'RELEASED', releasedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
    WHERE id = ${id} AND status = 'ACTIVE'
  `;
  return true;
}

export async function getHeldInventory(params: {
  categoryIds: string[];
  excludeOrderId?: string;
  excludeOrderIds?: string[];
  executor?: SqlExecutor;
}) {
  const executor = params.executor ?? db;
  await expireReservations(executor);
  const rows = await executor.$queryRaw<Array<{
    categoryId: string;
    quantity: number | bigint;
    tableId: string | null;
    seatId: string | null;
    orderId: string;
  }>>`
    SELECT ri.categoryId, ri.quantity, ri.tableId, ri.seatId, r.orderId
    FROM ReservationItem ri
    JOIN Reservation r ON r.id = ri.reservationId
    WHERE r.status = 'ACTIVE' AND r.expiresAt > CURRENT_TIMESTAMP
  `;
  const categorySet = new Set(params.categoryIds);
  const excludedOrderIds = new Set([...(params.excludeOrderIds ?? []), ...(params.excludeOrderId ? [params.excludeOrderId] : [])]);
  const seatIds = new Set<string>();
  const tableIds = new Set<string>();
  const categoryQuantities: Record<string, number> = {};

  for (const row of rows) {
    if (!categorySet.has(row.categoryId) || excludedOrderIds.has(row.orderId)) continue;
    categoryQuantities[row.categoryId] = (categoryQuantities[row.categoryId] ?? 0) + Number(row.quantity);
    if (row.seatId) seatIds.add(row.seatId);
    if (row.tableId) tableIds.add(row.tableId);
  }

  return {
    seatIds: [...seatIds],
    tableIds: [...tableIds],
    categoryQuantities,
  };
}
