import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { eventTypeValues, withEventType } from "@/lib/event-type";
import { eventDemandValues, eventInsightCategoryValues } from "@/lib/event-insight-options";
import { setEventInsights } from "@/lib/event-insights";

const schema = z.object({
  eventType: z.enum(eventTypeValues),
  interestScore: z.number().int().min(0).max(100),
  demandStatus: z.enum(eventDemandValues),
  categories: z.array(z.enum(eventInsightCategoryValues)).min(1).max(eventInsightCategoryValues.length),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireEventAccess("EVENT_MANAGE", id);
    const value = schema.parse(await request.json());
    const event = await db.event.findUnique({ where: { id }, select: { description: true } });
    if (!event) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });

    await db.event.update({
      where: { id },
      data: { description: withEventType(event.description, value.eventType) },
    });
    await setEventInsights(id, {
      interestScore: value.interestScore,
      demandStatus: value.demandStatus,
      categories: value.categories,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось сохранить настройки";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
