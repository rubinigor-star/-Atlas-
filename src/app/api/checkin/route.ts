import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkinSchema } from "@/lib/schemas";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { checkInTicket, normalizeTicketCode, type CheckinResult } from "@/lib/checkin";
import { checkInExternalTicket } from "@/lib/external-tickets";

type UnifiedCheckinResult = CheckinResult & {
  externalTicketId?: string;
  sourceName?: string;
  platformKey?: string | null;
};

type CountRow = { count: number | bigint };

export async function POST(req: Request) {
  try {
    const staff = await requirePermission("SCAN");
    const payload = await req.json();
    const { code } = checkinSchema.parse(payload);
    const selectedEventId = typeof payload.eventId === "string" && payload.eventId ? payload.eventId : null;
    if (selectedEventId && !canAccessEvent(staff, selectedEventId)) throw new Error("FORBIDDEN");
    const source = payload.source === "MANUAL" ? "MANUAL" : "CAMERA";
    const normalizedCode = normalizeTicketCode(code);
    let result: UnifiedCheckinResult = await checkInTicket({
      code: normalizedCode,
      staff,
      selectedEventId,
      deferNotFoundAudit: Boolean(selectedEventId),
    });

    if (result.status === "NOT_FOUND" && selectedEventId) {
      const external = await checkInExternalTicket(selectedEventId, normalizedCode);
      if (external.status === "AMBIGUOUS") {
        await db.scan.create({ data: { result: "NOT_FOUND" } });
        result = { status: "NOT_FOUND", message: external.message, eventId: selectedEventId, warning: "Проверьте билет вручную" };
      } else if (external.status === "NOT_FOUND") {
        await db.scan.create({ data: { result: "NOT_FOUND" } });
      } else {
        result = {
          status: external.status,
          message: external.message,
          externalTicketId: external.externalTicketId,
          eventId: external.eventId,
          holderName: external.holderName,
          categoryName: external.categoryName,
          sourceName: external.sourceName,
          platformKey: external.platformKey,
        };
      }
    }

    await writeAudit(staff, {
      action: `CHECKIN_${result.status}`,
      entityType: result.externalTicketId ? "ExternalTicket" : "Ticket",
      entityId: result.externalTicketId || result.ticketId,
      summary: `Сканирование: ${result.message}`,
      metadata: {
        code: normalizedCode.slice(0, 12),
        source,
        ticketSource: result.sourceName || "Atlas",
        eventId: result.eventId || selectedEventId,
        userAgent: req.headers.get("user-agent")?.slice(0, 180) || undefined,
      },
    });
    if (result.status === "VALID" && result.ticketId) await notifyWalletTickets([result.ticketId]);

    const allowedEvents = staff.eventAccess.map((item) => item.eventId);
    const scopedIds = staff.eventScope === "ALL" ? undefined : allowedEvents;
    const eventScope = selectedEventId
      ? { eventId: selectedEventId }
      : scopedIds
        ? { eventId: { in: scopedIds } }
        : {};
    const nativeEntered = await db.ticket.count({ where: { status: "USED", order: { status: "PAID", event: { organizationId: staff.organizationId! }, ...eventScope } } });
    let externalEntered = 0;
    if (selectedEventId) {
      const counts = await db.$queryRawUnsafe<CountRow[]>(
        `SELECT COUNT(*) AS "count" FROM "ExternalTicket" WHERE "eventId"=$1 AND "status"='USED'`,
        selectedEventId,
      );
      externalEntered = Number(counts[0]?.count || 0);
    }

    return NextResponse.json({ ...result, entered: nativeEntered + externalEntered, scannedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка проверки билета";
    const forbidden = message === "FORBIDDEN";
    return NextResponse.json({ status: "NOT_FOUND", message: forbidden ? "Недостаточно прав" : message, entered: 0, scannedAt: new Date().toISOString() }, { status: forbidden ? 403 : 400 });
  }
}
