import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createReservation } from "@/lib/reservation";
import { createTestAuthorization } from "@/lib/payment-authorization";

const TOKEN = "repair-scanner-order-0547299727-20260820";
const PUBLIC_ID = "ATL-SCANNER-VC-1787219926833";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const order = await db.order.findUnique({
    where: { publicId: PUBLIC_ID },
    include: { items: true, event: true },
  });
  if (!order) return NextResponse.json({ error: "order not found" }, { status: 404 });
  if (order.status !== "PENDING_APPROVAL") {
    return NextResponse.json({ error: "unexpected status", status: order.status }, { status: 409 });
  }

  const reservationItems = [] as Array<{ categoryId: string; quantity: number; tableId?: string | null; seatId?: string | null }>;
  for (const item of order.items) {
    const category = await db.ticketCategory.findUnique({
      where: { eventId_name: { eventId: order.eventId, name: item.categoryName } },
    });
    if (!category) return NextResponse.json({ error: `category not found: ${item.categoryName}` }, { status: 404 });
    reservationItems.push({ categoryId: category.id, quantity: item.quantity, tableId: item.tableId, seatId: item.seatId });
  }

  const reservation = await createReservation({ orderId: order.id, items: reservationItems, ttlMinutes: 180 });
  const authorization = await createTestAuthorization({
    orderId: order.id,
    amountMinor: 0,
    currency: order.currency,
    input: { method: "CARD", cardNumber: "4242424242424242", cardholderName: "Scanner Test", expiry: "12/30", cvc: "123" },
    captureImmediately: false,
  });

  return NextResponse.json({
    ok: true,
    order: { publicId: order.publicId, status: order.status, phone: order.customerPhone, eventId: order.eventId },
    reservation,
    authorization,
  });
}
