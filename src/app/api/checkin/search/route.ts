import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import {resolveStaffLocale} from "@/lib/i18n";

export async function GET(request: Request) {
  let locale:"ru"|"he"|"en"="ru";
  try {
    const staff = await requirePermission("SCAN");
    locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
    const text=locale==="he"?{forbidden:"אין הרשאה מתאימה",failed:"לא ניתן לבצע את החיפוש"}:locale==="en"?{forbidden:"Insufficient permission",failed:"Search failed"}:{forbidden:"Недостаточно прав",failed:"Не удалось выполнить поиск"};
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") || "").trim();
    const eventId = (url.searchParams.get("eventId") || "").trim();
    if (query.length < 2) return NextResponse.json({ results: [] });
    if (eventId && !canAccessEvent(staff, eventId)) return NextResponse.json({ message: text.forbidden }, { status: 403 });

    const allowedEvents = staff.eventAccess.map((item) => item.eventId);
    const scopedIds = staff.eventScope === "ALL" ? undefined : allowedEvents;
    const eventWhere = { organizationId: staff.organizationId!, ...(eventId ? { id: eventId } : scopedIds ? { id: { in: scopedIds } } : {}) };

    const tickets = await db.ticket.findMany({
      where: { order: { event: eventWhere, OR: [{ publicId: { contains: query } }, { customerName: { contains: query } }, { customerPhone: { contains: query } }, { customerEmail: { contains: query } }] } },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: { category: true, order: { include: { event: true } } },
    });

    return NextResponse.json({ results: tickets.map((ticket) => ({ ticketId: ticket.id, publicCode: ticket.publicCode, ticketStatus: ticket.status, holderName: ticket.holderName, categoryName: ticket.category.name, orderPublicId: ticket.order.publicId, phone: ticket.order.customerPhone, email: ticket.order.customerEmail, eventId: ticket.order.eventId, eventTitle: ticket.order.event.title })) });
  } catch (error) {
    console.error("[checkin-search]",error);
    const message=locale==="he"?"לא ניתן לבצע את החיפוש":locale==="en"?"Search failed":"Не удалось выполнить поиск";
    return NextResponse.json({ message }, { status: 400 });
  }
}
