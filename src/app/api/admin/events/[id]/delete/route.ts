import { NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/auth";
import { deleteDraftEvent } from "@/lib/event-delete";
import { writeAudit } from "@/lib/audit";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireEventAccess("EVENT_MANAGE", id);
    const deleted = await deleteDraftEvent(id);

    await writeAudit(actor, {
      action: "EVENT_DRAFT_DELETE",
      entityType: "Event",
      entityId: id,
      summary: `Черновик мероприятия ${deleted.title} удалён`,
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Недостаточно прав" : message },
      { status: message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
