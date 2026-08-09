import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";

const STATUS_GROUPS = {
  pending: ["PENDING", "PENDING_APPROVAL"] as const,
  approved: ["PAID"] as const,
  cancelled: ["CANCELLED", "REJECTED"] as const,
  abandoned: ["AWAITING_PAYMENT"] as const,
};

type GroupKey = keyof typeof STATUS_GROUPS;

function groupFromUrl(request: Request): GroupKey {
  const value = new URL(request.url).searchParams.get("status");
  return value && value in STATUS_GROUPS ? (value as GroupKey) : "pending";
}

function canAccessEvent(user: Awaited<ReturnType<typeof getMobileStaff>>, event: { id: string; organizationId: string }) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const organizationAccess = Boolean(user.organizationId && user.organizationId === event.organizationId);
  const hasExplicitScope = user.eventAccess.length > 0;
  const eventAccess = user.eventAccess.some((access) => access.eventId === event.id);
  return organizationAccess && (!hasExplicitScope || eventAccess);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.permissionSet.has("ORDER_VIEW") && user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await context.params;
  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      startsAt: true,
      posterUrl: true,
      organizationId: true,
      venue: { select: { name: true, city: true } },
    },
  });

  if (!event || !canAccessEvent(user, event)) {
    return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
  }

  const group = groupFromUrl(request);
  const [orders, groupedCounts, revenue, usedTickets] = await Promise.all([
    db.order.findMany({
      where: { eventId: id, status: { in: [...STATUS_GROUPS[group]] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        publicId: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        totalMinor: true,
        currency: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        reviewedAt: true,
        items: { select: { quantity: true, categoryName: true, unitPriceMinor: true } },
        tickets: { select: { id: true, status: true } },
      },
    }),
    db.order.groupBy({ by: ["status"], where: { eventId: id }, _count: { _all: true } }),
    db.order.aggregate({ where: { eventId: id, status: "PAID" }, _sum: { totalMinor: true } }),
    db.ticket.count({ where: { status: "USED", order: { eventId: id, status: "PAID" } } }),
  ]);

  const rawCounts = new Map<string, number>(groupedCounts.map((item) => [item.status, item._count._all]));
  const countGroup = (statuses: readonly string[]) => statuses.reduce((sum, status) => sum + (rawCounts.get(status) ?? 0), 0);

  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      startsAt: event.startsAt.toISOString(),
      posterUrl: event.posterUrl?.trim() || null,
      venue: event.venue,
      revenueMinor: revenue._sum.totalMinor ?? 0,
      checkedIn: usedTickets,
    },
    counts: {
      pending: countGroup(STATUS_GROUPS.pending),
      approved: countGroup(STATUS_GROUPS.approved),
      cancelled: countGroup(STATUS_GROUPS.cancelled),
      abandoned: countGroup(STATUS_GROUPS.abandoned),
    },
    group,
    orders: orders.map((order) => ({
      id: order.id,
      publicId: order.publicId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      totalMinor: order.totalMinor,
      currency: order.currency,
      status: order.status,
      reviewNote: order.reviewNote,
      createdAt: order.createdAt.toISOString(),
      reviewedAt: order.reviewedAt?.toISOString() ?? null,
      ticketCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      categories: order.items.map((item) => ({ name: item.categoryName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor })),
      usedTickets: order.tickets.filter((ticket) => ticket.status === "USED").length,
    })),
  });
}
