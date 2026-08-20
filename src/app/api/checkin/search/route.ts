import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessEvent, requirePermission } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    const staff = await requirePermission("SCAN");
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim();
    const eventId = (url.searchParams.get("eventId") || "").trim();
    if (query.length < 2) return NextResponse.json({ results: [] });
    if (eventId && !canAccessEvent(staff, eventId)) return NextResponse.json({ message: "Недостаточно прав" }, { status: 403 });

    const allowedEvents = staff.eventAccess.map((item) => item.eventId);
    const scopedIds = staff.eventScope === "ALL" ? undefined : allowedEvents;
    const eventWhere = {
      organizationId: staff.organizationId!,
      ...(eventId ? { id: eventId } : scopedIds ? { id: { in: scopedIds } } : {}),
    };

    const tickets = await db.ticket.findMany({
      where: { order: { event: eventWhere, OR: [{ publicId: { contains: query } }, { customerName: { contains: query } }, { customerPhone: { contains: query } }, { customerEmail: { contains: query } }] } },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { category: true, order: { include: { event: true } } },
    });

    return NextResponse.json({ results: tickets.map((ticket) => ({ ticketId: ticket.id, publicCode: ticket.publicCode, ticketStatus: ticket.status, holderName: ticket.holderName, categoryName: ticket.category.name, orderPublicId: ticket.order.publicId, phone: ticket.order.customerPhone, email: ticket.order.customerEmail, eventId: ticket.order.eventId, eventTitle: ticket.order.event.title })) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка поиска";
    return NextResponse.json({ message: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
