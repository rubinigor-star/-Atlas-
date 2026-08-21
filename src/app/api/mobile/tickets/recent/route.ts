import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";

export const dynamic = "force-dynamic";

type ExternalRecentRow = {
  id: string;
  result: string;
  scannedAt: Date | string;
  ticketId: string;
  publicCode: string;
  ticketStatus: string;
  holderName: string | null;
  categoryName: string | null;
  orderPublicId: string | null;
  customerName: string | null;
  phone: string | null;
  email: string | null;
  eventId: string;
  eventTitle: string;
  sourceName: string;
  platformKey: string | null;
};

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

  if (eventId) {
    const visibleEvent = await db.event.findFirst({ where: eventWhere, select: { id: true } });
    if (!visibleEvent) return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
  }

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

  const nativeResults = scans.map((scan) => ({
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
    sourceName: "Atlas",
    platformKey: null,
    external: false,
    event: scan.ticket ? { id: scan.ticket.order.event.id, title: scan.ticket.order.event.title } : null,
  }));

  let externalResults: Array<Record<string, unknown>> = [];
  if (eventId) {
    await ensureExternalTicketStorage();
    const rows = await db.$queryRawUnsafe<ExternalRecentRow[]>(
      `SELECT s."id",s."result",s."scannedAt",t."id" AS "ticketId",t."rawScanCode" AS "publicCode",t."status" AS "ticketStatus",
              t."holderName",t."ticketType" AS "categoryName",t."externalOrderId" AS "orderPublicId",t."holderName" AS "customerName",
              t."phone",t."email",t."eventId",e."title" AS "eventTitle",src."name" AS "sourceName",src."platformKey"
       FROM "ExternalTicketScan" s
       JOIN "ExternalTicket" t ON t."id"=s."externalTicketId"
       JOIN "ExternalTicketSource" src ON src."id"=t."sourceId"
       JOIN "Event" e ON e."id"=t."eventId"
       WHERE t."eventId"=$1
       ORDER BY s."scannedAt" DESC
       LIMIT 30`,
      eventId,
    );
    externalResults = rows.map((row) => ({
      id: row.id,
      result: row.result,
      scannedAt: new Date(row.scannedAt).toISOString(),
      ticketId: row.ticketId,
      publicCode: row.publicCode,
      ticketStatus: row.ticketStatus,
      holderName: row.holderName,
      categoryName: row.categoryName,
      orderPublicId: row.orderPublicId,
      customerName: row.customerName,
      phone: row.phone,
      email: row.email,
      sourceName: row.sourceName,
      platformKey: row.platformKey,
      external: true,
      event: { id: row.eventId, title: row.eventTitle },
    }));
  }

  const results = [...nativeResults, ...externalResults]
    .sort((a, b) => new Date(String(b.scannedAt)).getTime() - new Date(String(a.scannedAt)).getTime())
    .slice(0, 30);

  return NextResponse.json({ results }, { headers: { "cache-control": "no-store" } });
}
