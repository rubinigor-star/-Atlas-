import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { deleteDraftEvent } from "@/lib/event-delete";
import { writeAudit } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await getMobileStaff(request);
    if (!actor) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    if (!actor.permissionSet.has("EVENT_MANAGE")) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

    const event = await db.event.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!event) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });

    const organizationAccess = actor.role === "ADMIN" || Boolean(actor.organizationId && actor.organizationId === event.organizationId);
    const scoped = actor.eventAccess.length > 0;
    const eventAccess = actor.eventAccess.some((access) => access.eventId === id);
    if (!organizationAccess || (scoped && !eventAccess)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

    const deleted = await deleteDraftEvent(id);
    await writeAudit(actor, {
      action: "EVENT_DRAFT_DELETE",
      entityType: "Event",
      entityId: id,
      summary: `Черновик мероприятия ${deleted.title} удалён из мобильного приложения`,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось удалить черновик" }, { status: 400 });
  }
}
