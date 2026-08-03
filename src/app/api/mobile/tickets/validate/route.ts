import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { validateAndUseTicket } from "@/lib/ticket-engine";

const schema = z.object({ code: z.string().min(6).max(500) });

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

export async function POST(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.permissionSet.has("SCAN")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  try {
    const { code: rawCode } = schema.parse(await request.json());
    const code = normalizeTicketCode(rawCode);
    const ticket = await db.ticket.findUnique({
      where: { publicCode: code },
      select: {
        order: {
          select: {
            event: { select: { id: true, title: true, organizationId: true } },
          },
        },
      },
    });

    if (ticket && user.role !== "ADMIN") {
      const event = ticket.order.event;
      const hasExplicitEventScope = user.eventAccess.length > 0;
      const canAccessOrganization = Boolean(user.organizationId && event.organizationId === user.organizationId);
      const canAccessEvent = user.eventAccess.some((access) => access.eventId === event.id);
      if (!canAccessOrganization || (hasExplicitEventScope && !canAccessEvent)) {
        return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
      }
    }

    const result = await validateAndUseTicket(code);
    const event = ticket?.order.event;
    const status = result.result === "NOT_FOUND" ? 404 : result.result === "VALID" ? 200 : 409;
    return NextResponse.json(
      { ...result, event: event ? { id: event.id, title: event.title } : null },
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
