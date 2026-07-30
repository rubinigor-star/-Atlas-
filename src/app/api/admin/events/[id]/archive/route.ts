import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { ensureEventArchiveRuntime, isEventArchived } from "@/lib/event-archive";

const bodySchema = z.object({ action: z.enum(["archive", "restore"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireEventAccess("EVENT_MANAGE", id);
    const input = bodySchema.parse(await req.json());
    const event = await db.event.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
    if (!event) throw new Error("Мероприятие не найдено");
    await ensureEventArchiveRuntime();

    if (input.action === "archive") {
      if (await isEventArchived(id)) return NextResponse.json({ ok: true, archived: true });
      await db.$transaction(async (tx) => {
        await tx.event.update({ where: { id }, data: { status: "DRAFT" } });
        await tx.$executeRawUnsafe(
          `INSERT INTO EventArchiveState (eventId,archivedAt,archivedById,previousStatus) VALUES (?,?,?,?)`,
          id,
          new Date().toISOString(),
          actor.id,
          String(event.status),
        );
      });
      await writeAudit(actor, {
        action: "EVENT_ARCHIVE",
        entityType: "Event",
        entityId: id,
        summary: `Мероприятие ${event.title} архивировано и скрыто из публичной афиши`,
      });
      return NextResponse.json({ ok: true, archived: true });
    }

    if (!(await isEventArchived(id))) throw new Error("Восстановить можно только архивированное мероприятие");
    await db.$executeRawUnsafe(`DELETE FROM EventArchiveState WHERE eventId=?`, id);
    await writeAudit(actor, {
      action: "EVENT_RESTORE_FROM_ARCHIVE",
      entityType: "Event",
      entityId: id,
      summary: `Мероприятие ${event.title} восстановлено из архива как черновик`,
    });
    return NextResponse.json({ ok: true, archived: false, status: "DRAFT" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Недостаточно прав" : message },
      { status: message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
