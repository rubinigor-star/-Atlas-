import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.permissionSet.has("SCAN")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const url = new URL(request.url);
  const eventId = (url.searchParams.get("eventId") || "").trim();
  const scopedEventIds = user.eventAccess.map((access) => access.eventId);

  const eventWhere = {
    ...(user.role === "ADMIN" ? {} : { organizationId: user.organizationId ?? "__none__" }),
    ...(eventId ? { id: eventId } : scopedEventIds.length ? { id: { in: scopedEventIds } } : {}),
  };

  const scans = await db.scan.findMany({
    where: {
      ticket: {
        order: { event: eventWhere },
      },
    },
    include: {
      ticket: {
        include: {
          category: true,
          order: { include: { event: { select: { id: true, title: true } } } },
        },
      },
    },
    orderBy: { scannedAt: "desc" },
    take: 30,
  });

  return NextResponse.json({
    results: scans.map((scan) => ({
      id: scan.id,
      result: scan.result,
      scannedAt: scan.scannedAt.toISOString(),
      ticketId: scan.ticket?.id ?? null,
      publicCode: scan.ticket?.publicCode ?? null,
      ticketStatus: scan.ticket?.status ?? null,
      holderName: scan.ticket?.holderName ?? null,
      categoryName: scan.ticket?.category.name ?? null,
      orderPublicId: scan.ticket?.order.publicId ?? null,
      customerName: scan.ticket?.order.customerName ?? null,
      phone: scan.ticket?.order.customerPhone ?? null,
      email: scan.ticket?.order.customerEmail ?? null,
      event: scan.ticket ? { id: scan.ticket.order.event.id, title: scan.ticket.order.event.title } : null,
    })),
  }, { headers: { "cache-control": "no-store" } });
}
