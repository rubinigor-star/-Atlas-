import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";

export const dynamic = "force-dynamic";

const CHECKIN_OPENS_BEFORE_MS = 3 * 60 * 60 * 1000;
const CHECKIN_CLOSES_AFTER_MS = 12 * 60 * 60 * 1000;

type ExternalCountRow = {
  eventId: string;
  expected: bigint | number | string;
  checkedIn: bigint | number | string;
};

function checkInWindow(startsAt: Date) {
  return {
    opensAt: new Date(startsAt.getTime() - CHECKIN_OPENS_BEFORE_MS),
    closesAt: new Date(startsAt.getTime() + CHECKIN_CLOSES_AFTER_MS),
  };
}

export async function GET(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const now = new Date();
  const scopedEventIds = user.eventAccess.map((access) => access.eventId);
  const eventWhere = {
    ...(user.role === "ADMIN" ? {} : { organizationId: user.organizationId ?? "__none__" }),
    ...(scopedEventIds.length ? { id: { in: scopedEventIds } } : {}),
  };

  const [events, paidRevenue, pendingRequests, recentOrders] = await Promise.all([
    db.event.findMany({
      where: eventWhere,
      include: { venue: true, categories: true },
      orderBy: { startsAt: "desc" },
      take: 100,
    }),
    db.order.aggregate({
      where: { event: eventWhere, status: "PAID" },
      _sum: { totalMinor: true },
      _count: { _all: true },
    }),
    db.order.count({
      where: { event: eventWhere, status: "PENDING_APPROVAL" },
    }),
    db.order.findMany({
      where: { event: eventWhere },
      include: { event: true, tickets: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const eventIds = events.map((event) => event.id);
  const usedTickets = eventIds.length
    ? await db.ticket.findMany({
        where: {
          status: "USED",
          order: { eventId: { in: eventIds }, status: "PAID" },
        },
        select: { order: { select: { eventId: true } } },
      })
    : [];

  const checkedInByEvent = new Map<string, number>();
  for (const ticket of usedTickets) {
    checkedInByEvent.set(ticket.order.eventId, (checkedInByEvent.get(ticket.order.eventId) ?? 0) + 1);
  }

  const externalExpectedByEvent = new Map<string, number>();
  const externalCheckedInByEvent = new Map<string, number>();
  if (eventIds.length) {
    await ensureExternalTicketStorage();
    const placeholders = eventIds.map((_, index) => `$${index + 1}`).join(",");
    const rows = await db.$queryRawUnsafe<ExternalCountRow[]>(
      `SELECT "eventId",
              COUNT(*) FILTER (WHERE "status" <> 'CANCELLED') AS "expected",
              COUNT(*) FILTER (WHERE "status" = 'USED') AS "checkedIn"
       FROM "ExternalTicket"
       WHERE "eventId" IN (${placeholders})
       GROUP BY "eventId"`,
      ...eventIds,
    );
    for (const row of rows) {
      externalExpectedByEvent.set(row.eventId, Number(row.expected ?? 0));
      externalCheckedInByEvent.set(row.eventId, Number(row.checkedIn ?? 0));
    }
  }

  const visibleEvents = events.map((event) => {
    const atlasSold = event.categories.reduce((sum, category) => sum + category.sold, 0);
    const sold = atlasSold + (externalExpectedByEvent.get(event.id) ?? 0);
    const capacity = event.categories.reduce((sum, category) => sum + category.capacity, 0);
    const checkedIn = (checkedInByEvent.get(event.id) ?? 0) + (externalCheckedInByEvent.get(event.id) ?? 0);
    const published = event.status === "PUBLISHED";
    const { opensAt, closesAt } = checkInWindow(event.startsAt);
    const isPast = now > closesAt;
    const status = event.status === "DRAFT" ? "DRAFT" : isPast ? "PAST" : "PUBLISHED";

    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      venue: { name: event.venue.name, city: event.venue.city },
      posterUrl: event.posterUrl?.trim() || null,
      published,
      salesMode: event.salesMode,
      mapEnabled: event.mapEnabled,
      sold,
      capacity,
      checkedIn,
      checkInOpensAt: opensAt.toISOString(),
      checkInClosesAt: closesAt.toISOString(),
      checkInOpen: published && now >= opensAt && now <= closesAt,
      status,
    };
  });

  const activeEvents = visibleEvents.filter((event) => event.status === "PUBLISHED");

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffRole: user.staffRole,
        jobTitle: user.jobTitle,
        organization: user.organization ? { id: user.organization.id, name: user.organization.name } : null,
        permissions: Array.from(user.permissionSet),
        staffLocale: user.staffLocale,
        localePreference: user.localePreference,
      },
      summary: {
        revenueMinor: paidRevenue._sum.totalMinor ?? 0,
        paidOrders: paidRevenue._count._all,
        pendingRequests,
        activeEvents: activeEvents.length,
      },
      events: visibleEvents,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        publicId: order.publicId,
        customerName: order.customerName,
        totalMinor: order.totalMinor,
        status: order.status,
        ticketCount: order.tickets.length,
        createdAt: order.createdAt.toISOString(),
        event: { id: order.event.id, title: order.event.title },
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
