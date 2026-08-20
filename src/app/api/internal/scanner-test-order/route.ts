import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TOKEN = "scanner-order-0547299727-20260820";
const PUBLIC_ID = "ATL-SCANNER-VC-1787219926833";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const order = await db.order.findUnique({ where: { publicId: PUBLIC_ID }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });

  const category = await db.ticketCategory.findUnique({
    where: { eventId_name: { eventId: order.eventId, name: order.items[0]?.categoryName || "Scanner Test" } },
  });
  if (!category) return NextResponse.json({ error: "category not found" }, { status: 404 });

  const reservationRows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM "Reservation" WHERE "orderId" = ${order.id} LIMIT 1
  `;
  if (!reservationRows[0]) {
    const reservationId = `res_${randomUUID().replace(/-/g, "")}`;
    const reservationItemId = `resi_${randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
    await db.$executeRaw`
      INSERT INTO "Reservation" (id, "orderId", status, "expiresAt", "createdAt", "updatedAt")
      VALUES (${reservationId}, ${order.id}, 'ACTIVE', ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    await db.$executeRaw`
      INSERT INTO "ReservationItem" (id, "reservationId", "categoryId", quantity, "tableId", "seatId", "createdAt")
      VALUES (${reservationItemId}, ${reservationId}, ${category.id}, 1, NULL, NULL, CURRENT_TIMESTAMP)
    `;
  }

  const authRows = await db.$queryRaw<Array<{ id: string; status: string }>>`
    SELECT id, status FROM "PaymentAuthorization" WHERE "orderId" = ${order.id} LIMIT 1
  `;
  if (!authRows[0]) {
    const authId = `auth_${randomUUID().replace(/-/g, "")}`;
    const providerReference = `atlas_test_${randomUUID().replace(/-/g, "")}`;
    const expiresAt = new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000);
    await db.$executeRaw`
      INSERT INTO "PaymentAuthorization" (
        id, "orderId", provider, "providerReference", method, status,
        "amountMinor", currency, "cardLast4", "authorizedAt", "capturedAt", "expiresAt", "createdAt", "updatedAt"
      ) VALUES (
        ${authId}, ${order.id}, 'ATLAS_TEST', ${providerReference}, 'CARD', 'AUTHORIZED',
        0, ${order.currency}, '4242', CURRENT_TIMESTAMP, NULL, ${expiresAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;
  }

  const reservation = await db.$queryRaw<Array<{ id: string; status: string; expiresAt: Date }>>`
    SELECT id, status, "expiresAt" FROM "Reservation" WHERE "orderId" = ${order.id} LIMIT 1
  `;
  const authorization = await db.$queryRaw<Array<{ id: string; status: string; provider: string; amountMinor: number }>>`
    SELECT id, status, provider, "amountMinor" FROM "PaymentAuthorization" WHERE "orderId" = ${order.id} LIMIT 1
  `;

  return NextResponse.json({
    ok: true,
    order: { publicId: order.publicId, status: order.status, phone: order.customerPhone },
    reservation: reservation[0] || null,
    authorization: authorization[0] || null,
  });
}
