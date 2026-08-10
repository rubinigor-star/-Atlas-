import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { cloneEvent, cloneEventSchema } from "@/lib/event-clone";

export async function POST(req: Request) {
  try {
    const input = cloneEventSchema.parse(await req.json());
    const actor = await requirePermission("EVENT_MANAGE");
    const result = await cloneEvent(actor, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message || "Проверьте данные мероприятия" }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка копирования" }, { status: 400 });
  }
}
