import { NextResponse } from "next/server";
import { createEventDraftForActor } from "@/lib/event-draft";
import { getMobileStaff } from "@/lib/mobile-auth";

export async function POST(request: Request) {
  const actor = await getMobileStaff(request);
  if (!actor) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!actor.permissionSet.has("EVENT_MANAGE")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  try {
    const event = await createEventDraftForActor(actor);
    return NextResponse.json({ id: event.id }, { status: 201 });
  } catch (error) {
    console.error("mobile.event_draft.create_failed", { userId: actor.id, error });
    return NextResponse.json({ error: "EVENT_DRAFT_CREATE_FAILED" }, { status: 400 });
  }
}
