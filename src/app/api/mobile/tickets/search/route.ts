import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

function normalizePhoneSearch(value: string) {
  return value.replace(/\D/g, "");
}

export async function GET(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.permissionSet.has("SCAN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const eventId = (url.searchParams.get("eventId") || "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] }, { headers: { "cache-control": "no-store" } });

  const scopedEventIds = user.eventAccess.map((access) => access.eventId);
  if (eventId && user.role !== "ADMIN") {
    const inOrganization = Boolean(user.organizationId);
    const hasExplicitEventScope = scopedEventIds.length > 0;
    const eventAllowed = !hasExplicitEventScope || scopedEventIds.includes(eventId);
    if (!inOrganization || !eventAllowed) return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
  }

  const eventWhere = {
    ...(user.role === "ADMIN" ? {} : { organizationId: user.organizationId ?? "__none__" }),
    ...(eventId ? { id: eventId } : scopedEventIds.length ? { id: { in: scopedEventIds } } : {}),
  };

  const phoneDigits = normalizePhoneSearch(q);
  const orderMatches = [
    { publicId: { contains: q, mode: "insensitive" as const } },
    { customerName: { contains: q, mode: "insensitive" as const } },
    { customerEmail: { contains: q, mode: "insensitive" as const } },
    { customerPhone: { contains: q } },
    ...(phoneDigits.length >= 4 && phoneDigits !== q ? [{ customerPhone: { contains: phoneDigits } }] : []),
  ];

  const tickets = await db.ticket.findMany({
    where: {
      order: {
        event: eventWhere,
        status: "PAID",
        OR: orderMatches,
      },
    },
    include: {
      category: true,
      order: { include: { event: { select: { id: true, title: true, startsAt: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    results: tickets.map((ticket) => ({
      ticketId: ticket.id,
      publicCode: ticket.publicCode,
      ticketStatus: ticket.status,
      holderName: ticket.holderName,
      categoryName: ticket.category.name,
      orderPublicId: ticket.order.publicId,
      customerName: ticket.order.customerName,
      phone: ticket.order.customerPhone,
      email: ticket.order.customerEmail,
      eventId: ticket.order.event.id,
      eventTitle: ticket.order.event.title,
      eventStartsAt: ticket.order.event.startsAt.toISOString(),
      canCheckIn: ticket.status === "VALID",
    })),
  }, { headers: { "cache-control": "no-store" } });
}
