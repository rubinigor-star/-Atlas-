import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { createEventDraftForActor } from "@/lib/event-draft";
import { assignAutoPromotersV2ToEvent } from "@/lib/promoter-v2-workflow";

export async function POST() {
  try {
    const actor = await requirePermission("EVENT_MANAGE");
    const event = await createEventDraftForActor(actor);
    await assignAutoPromotersV2ToEvent(event.id);
    return NextResponse.json({ id: event.id }, { status: 201 });
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "FORBIDDEN";
    return NextResponse.json(
      { error: forbidden ? "Недостаточно прав" : error instanceof Error ? error.message : "Ошибка" },
      { status: forbidden ? 403 : 400 },
    );
  }
}
