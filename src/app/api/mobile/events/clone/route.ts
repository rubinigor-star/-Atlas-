import { NextResponse } from "next/server";
import { z } from "zod";
import { getMobileStaff } from "@/lib/mobile-auth";
import { cloneEvent, cloneEventSchema } from "@/lib/event-clone";

export async function POST(req: Request) {
  const actor = await getMobileStaff(req);
  if (!actor) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!actor.permissionSet.has("EVENT_MANAGE")) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  try {
    const input = cloneEventSchema.parse(await req.json());
    const result = await cloneEvent(actor, input);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "INVALID_EVENT_DATA", issues: error.issues.map((issue) => ({ path: issue.path, code: issue.code })) }, { status: 400 });
    console.error("mobile.event_clone.failed", { userId: actor.id, error });
    return NextResponse.json({ error: "EVENT_CLONE_FAILED" }, { status: 400 });
  }
}
