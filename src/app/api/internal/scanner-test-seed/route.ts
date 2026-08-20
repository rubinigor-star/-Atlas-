import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { issueTicketsForOrder } from "@/lib/ticket-engine";
import { sendOrderTicketEmail } from "@/lib/order-email";

const TOKEN = "scanner-test-20260820-1150-rubin";
const EMAIL = "Rubin.igor@gmail.com";
const SLUG = "scanner-test-20260820";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const organizations = await db.organization.findMany({ select: { id: true, name: true } });
  const organization = organizations.find(o => o.name.trim().toLowerCase() === "malina") || organizations.find(o => o.name.toLowerCase().includes("malina"));
  if (!organization) return NextResponse.json({ error: "Malina organization not found" }, { status: 404 });
  const latestEvent = await db.event.findFirst({ where: { organizationId: organization.id }, orderBy: { createdAt: "desc" }, include: { venue: true } });
  if (!latestEvent) return NextResponse.json({ error: "No Malina event/venue found" }, { status: 404 });
  let event = await db.event.findUnique({ where: { slug: SLUG } });
  if (!event) event = await db.event.create({ data: { slug: SLUG, title: "Scanner Test", description: "Scanner Test - temporary event for QR scanner validation", posterUrl: latestEvent.posterUrl || "", startsAt: new Date("2026-08-20T08:50:00.000Z"), salesStart: new Date("2026-08-20T08:45:00.000Z"), salesEnd: new Date("2026-08-20T14:00:00.000Z"), status: "PUBLISHED", salesMode: "INSTANT", organizationId: organization.id, venueId: latestEvent.venueId } });
  let category = await db.ticketCategory.findUnique({ where: { eventId_name: { eventId: event.id, name: "Scanner Test" } } });
  if (!category) category = await db.ticketCategory.create({ data: { eventId: event.id, name: "Scanner Test", description: "10 QR tickets for scanner testing", priceMinor: 0, currency: "ILS", capacity: 10, sold: 10, minPerOrder: 1, maxPerOrder: 10 } });
  let order = await db.order.findFirst({ where: { eventId: event.id, customerEmail: EMAIL } });
  if (!order) order = await db.order.create({ data: { publicId: `ATL-SCANNER-${Date.now()}`, idempotencyKey: `scanner-test-${Date.now()}`, customerName: "Igor Rubin", customerFirstName: "Igor", customerLastName: "Rubin", customerEmail: EMAIL, customerPhone: "0500000000", totalMinor: 0, currency: "ILS", status: "PAID", salesFlow: "DIRECT", eventId: event.id, items: { create: [{ quantity: 10, unitPriceMinor: 0, categoryName: category.name }] } } });
  const tickets = await issueTicketsForOrder(order.id);
  const emailResult = await sendOrderTicketEmail(order.publicId);
  return NextResponse.json({ ok: true, organization: organization.name, event: { id: event.id, slug: event.slug, title: event.title, startsAt: event.startsAt, salesEnd: event.salesEnd }, venue: latestEvent.venue, order: { id: order.id, publicId: order.publicId, email: order.customerEmail }, tickets: tickets.map(t => ({ id: t.id, publicCode: t.publicCode, status: t.status })), emailResult });
}
