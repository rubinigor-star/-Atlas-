import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkinSchema } from "@/lib/schemas";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { checkInTicket, normalizeTicketCode } from "@/lib/checkin";

export async function POST(req: Request) {
  try {
    const staff = await requirePermission("SCAN");
    const payload = await req.json();
    const { code } = checkinSchema.parse(payload);
    const selectedEventId = typeof payload.eventId === "string" && payload.eventId ? payload.eventId : null;
    const source = payload.source === "MANUAL" ? "MANUAL" : "CAMERA";
    const normalizedCode = normalizeTicketCode(code);

    const result = await checkInTicket({ code: normalizedCode, staff, selectedEventId });

    await writeAudit(staff, {
      action: `CHECKIN_${result.status}`,
      entityType: "Ticket",
      entityId: result.ticketId,
      summary: `Сканирование: ${result.message}`,
      metadata: {
        code: normalizedCode.slice(0, 12),
        source,
        eventId: result.eventId || selectedEventId,
        userAgent: req.headers.get("user-agent")?.slice(0, 180) || undefined,
      },
    });

    if (result.status === "VALID" && result.ticketId) {
      await notifyWalletTickets([result.ticketId]);
    }

    const allowedEvents = staff.eventAccess.map((item) => item.eventId);
    const eventScope = selectedEventId
      ? { eventId: selectedEventId }
      : allowedEvents.length
        ? { eventId: { in: allowedEvents } }
        : {};
    const entered = await db.ticket.count({
      where: {
        status: "USED",
        order: {
          status: "PAID",
          event: { organizationId: staff.organizationId! },
          ...eventScope,
        },
      },
    });

    return NextResponse.json({ ...result, entered, scannedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка проверки билета";
    const forbidden = message === "FORBIDDEN";
    return NextResponse.json(
      {
        status: "NOT_FOUND",
        message: forbidden ? "Недостаточно прав" : message,
        entered: 0,
        scannedAt: new Date().toISOString(),
      },
      { status: forbidden ? 403 : 400 },
    );
  }
}
