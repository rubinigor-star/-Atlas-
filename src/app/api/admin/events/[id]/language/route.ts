import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { catalogVisibilityValues, eventLanguageValues } from "@/lib/event-language";
import { getEventLanguageSettings, saveEventLanguageSettings } from "@/lib/event-language-server";

const schema = z.object({
  primaryLanguage: z.enum(eventLanguageValues),
  catalogVisibility: z.enum(catalogVisibilityValues),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = schema.parse(await req.json());
    const actor = await requireEventAccess("EVENT_MANAGE", id);
    const event = await db.event.findUniqueOrThrow({ where: { id }, select: { title: true } });
    const before = await getEventLanguageSettings(id);
    await saveEventLanguageSettings(id, input, actor.id);
    await writeAudit(actor, {
      action: "EVENT_LANGUAGE_UPDATED",
      entityType: "Event",
      entityId: id,
      summary: `Обновлены язык и аудитория мероприятия ${event.title}`,
      metadata: { before, after: input },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
