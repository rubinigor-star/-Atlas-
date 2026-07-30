import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { saveEventTerms } from "@/lib/commercial-terms";

const schema = z.object({
  useOrganizerDefaults: z.boolean(),
  serviceFeePayer: z.enum(["BUYER", "ORGANIZER"]),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireEventAccess("EVENT_MANAGE", id);
  const event = await db.event.findUnique({ where: { id }, select: { organizationId: true } });
  if (!event) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TERMS", details: parsed.error.flatten() }, { status: 400 });
  const terms = await saveEventTerms(id, event.organizationId, actor.id, parsed.data);
  return NextResponse.json({ terms });
}
