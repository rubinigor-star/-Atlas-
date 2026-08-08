import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { validateAndUseTicket } from "@/lib/ticket-engine";

const schema = z.object({
  eventId: z.string().min(1).max(200),
  code: z.string().min(6).max(500),
});

const CHECKIN_OPENS_BEFORE_MS = 3 * 60 * 60 * 1000;
const CHECKIN_CLOSES_AFTER_MS = 12 * 60 * 60 * 1000;

function normalizeTicketCode(value: string) {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return (
      url.searchParams.get("code") ||
      url.pathname.split("/").filter(Boolean).at(-1) ||
      trimmed
    );
  } catch {
    return trimmed;
  }
}

function isCheckInOpen(startsAt: Date, now = new Date()) {
  const starts = startsAt.getTime();
  const current = now.getTime();
  return current >= starts - CHECKIN_OPENS_BEFORE_MS && current <= starts + CHECKIN_CLOSES_AFTER_MS;
}

export async function POST(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.permissionSet.has("SCAN")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const { eventId, code: rawCode } = schema.parse(await request.json());
    const selectedEvent = await db.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true, startsAt: true, organizationId: true, status: true },
    });

    if (!selectedEvent || selectedEvent.status !== "PUBLISHED") {
      return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
    }

    if (user.role !== "ADMIN") {
      const hasExplicitEventScope = user.eventAccess.length > 0;
      const canAccessOrganization = Boolean(user.organizationId && selectedEvent.organizationId === user.organizationId);
      const canAccessEvent = user.eventAccess.some((access) => access.eventId === selectedEvent.id);
      if (!canAccessOrganization || (hasExplicitEventScope && !canAccessEvent)) {
        return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
      }
    }

    if (!isCheckInOpen(selectedEvent.startsAt)) {
      return NextResponse.json({ error: "CHECKIN_CLOSED" }, { status: 409 });
    }

    const code = normalizeTicketCode(rawCode);
    const ticket = await db.ticket.findUnique({
      where: { publicCode: code },
      select: {
        order: {
          select: {
            event: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (ticket && ticket.order.event.id !== selectedEvent.id) {
      return NextResponse.json(
        {
          error: "WRONG_EVENT",
          scannedEvent: { id: ticket.order.event.id, title: ticket.order.event.title },
          expectedEvent: { id: selectedEvent.id, title: selectedEvent.title },
        },
        { status: 409 },
      );
    }

    const result = await validateAndUseTicket(code);
    const status = result.result === "NOT_FOUND" ? 404 : result.result === "VALID" ? 200 : 409;
    return NextResponse.json(
      { ...result, event: { id: selectedEvent.id, title: selectedEvent.title } },
      { status },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "INVALID_QR" }, { status: 400 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "SCAN_FAILED" },
      { status: 400 },
    );
  }
}
