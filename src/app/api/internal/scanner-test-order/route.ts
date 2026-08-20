import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const TOKEN = "scanner-order-0547299727-20260820";
const SLUG = "scanner-test-20260820";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const event = await db.event.findUnique({ where: { slug: SLUG } });
  if (!event) return NextResponse.json({ error: "Scanner Test event not found" }, { status: 404 });

  const category = await db.ticketCategory.findUnique({ where: { eventId_name: { eventId: event.id, name: "Scanner Test" } } });
  if (!category) return NextResponse.json({ error: "Scanner Test category not found" }, { status: 404 });

  if (category.capacity < category.sold + 1) {
    await db.ticketCategory.update({ where: { id: category.id }, data: { capacity: category.sold + 10 } });
  }

  const existing = await db.order.findFirst({
    where: { eventId: event.id, customerPhone: "0547299727", status: "PENDING_APPROVAL" },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return NextResponse.json({ ok: true, reused: true, order: { publicId: existing.publicId, status: existing.status, phone: existing.customerPhone } });

  const now = Date.now();
  const order = await db.order.create({
    data: {
      publicId: `ATL-SCANNER-VC-${now}`,
      idempotencyKey: `scanner-valuecard-${now}`,
      customerName: "Igor Rubin",
      customerFirstName: "Igor",
      customerLastName: "Rubin",
      customerEmail: "Rubin.igor@gmail.com",
      customerPhone: "0547299727",
      totalMinor: 0,
      currency: "ILS",
      status: "PENDING_APPROVAL",
      salesFlow: "APPROVAL",
      eventId: event.id,
      items: { create: [{ quantity: 1, unitPriceMinor: 0, categoryName: category.name }] },
    },
  });

  return NextResponse.json({ ok: true, reused: false, event: { id: event.id, title: event.title }, order: { publicId: order.publicId, status: order.status, phone: order.customerPhone, email: order.customerEmail } });
}
