import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

const bodySchema = z.object({ action: z.enum(["archive", "restore"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const actor = await requireEventAccess("EVENT_MANAGE", id);
    const input = bodySchema.parse(await req.json());
    const event = await db.event.findUnique({ where: { id }, select: { id: true, title: true, status: true } });
    if (!event) throw new Error("Мероприятие не найдено");

    if (input.action === "archive") {
      if (event.status === "ARCHIVED") return NextResponse.json({ ok: true, status: "ARCHIVED" });
      await db.event.update({ where: { id }, data: { status: "ARCHIVED" } });
      await writeAudit(actor, {
        action: "EVENT_ARCHIVE",
        entityType: "Event",
        entityId: id,
        summary: `Мероприятие ${event.title} архивировано и скрыто из публичной афиши`,
      });
      return NextResponse.json({ ok: true, status: "ARCHIVED" });
    }

    if (event.status !== "ARCHIVED") throw new Error("Восстановить можно только архивированное мероприятие");
    await db.event.update({ where: { id }, data: { status: "DRAFT" } });
    await writeAudit(actor, {
      action: "EVENT_RESTORE_FROM_ARCHIVE",
      entityType: "Event",
      entityId: id,
      summary: `Мероприятие ${event.title} восстановлено из архива как черновик`,
    });
    return NextResponse.json({ ok: true, status: "DRAFT" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json(
      { error: message === "FORBIDDEN" ? "Недостаточно прав" : message },
      { status: message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
