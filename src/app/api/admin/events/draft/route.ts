import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createEventDraftForActor } from "@/lib/event-draft";

export async function POST() {
  try {
    const actor = await requirePermission("EVENT_MANAGE");
    const event = await createEventDraftForActor(actor);
    return NextResponse.json({ id: event.id }, { status: 201 });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Недостаточно прав" : error instanceof Error ? error.message : "Ошибка" },
      { status: forbidden ? 403 : 400 },
    );
  }
}
