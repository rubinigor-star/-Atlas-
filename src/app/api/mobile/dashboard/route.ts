import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const scopedEventIds = user.eventAccess.map((access) => access.eventId);
  const eventWhere = {
    ...(user.role === "ADMIN" ? {} : { organizationId: user.organizationId ?? "__none__" }),
    ...(scopedEventIds.length ? { id: { in: scopedEventIds } } : {}),
    status: "PUBLISHED" as const,
  };

  const [events, paidRevenue, pendingRequests, recentOrders] = await Promise.all([
    db.event.findMany({
      where: eventWhere,
      include: { venue: true, categories: true },
      orderBy: { startsAt: "asc" },
      take: 50,
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

  const now = new Date();
  const visibleEvents = events.map((event) => {
    const sold = event.categories.reduce((sum, category) => sum + category.sold, 0);
    const capacity = event.categories.reduce((sum, category) => sum + category.capacity, 0);

    return {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      venue: { name: event.venue.name, city: event.venue.city },
      posterUrl: event.posterUrl,
      published: true,
      salesMode: event.salesMode,
      mapEnabled: event.mapEnabled,
      sold,
      capacity,
      status: event.startsAt < now ? "PAST" : "PUBLISHED",
    };
  });

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
      },
      summary: {
        revenueMinor: paidRevenue._sum.totalMinor ?? 0,
        paidOrders: paidRevenue._count._all,
        pendingRequests,
        activeEvents: visibleEvents.filter((event) => event.status !== "PAST").length,
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
