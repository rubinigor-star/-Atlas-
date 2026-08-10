import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { getEventBasics, updateEventBasics } from "@/lib/event-basics";

const updateBasics = z.object({
  title: z.string().min(3).max(50),
  description: z.string().min(20),
  posterUrl: z.string().min(1),
  startsAt: z.string().datetime(),
  venueName: z.string().min(2).max(160),
  city: z.string().min(2).max(120),
  address: z.string().min(3).max(300),
});

async function authorize(request: Request, eventId: string, permission: "EVENT_VIEW" | "EVENT_MANAGE") {
  const actor = await getMobileStaff(request);
  if (!actor) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) } as const;
  if (!actor.permissionSet.has(permission)) {
    return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  }
  const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true, organizationId: true } });
  if (!event) return { error: NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 }) } as const;
  const organizationAccess = actor.role === "ADMIN" || Boolean(actor.organizationId && actor.organizationId === event.organizationId);
  const scoped = actor.eventAccess.length > 0;
  const eventAccess = actor.eventAccess.some((access) => access.eventId === eventId);
  if (!organizationAccess || (scoped && !eventAccess)) {
    return { error: NextResponse.json({ error: "Недостаточно прав" }, { status: 403 }) } as const;
  }
  return { actor, event } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await authorize(request, id, "EVENT_VIEW");
  if ("error" in auth) return auth.error;
  const event = await getEventBasics(id);
  if (!event) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });
  return NextResponse.json({ event, permissions: Array.from(auth.actor.permissionSet) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const auth = await authorize(request, id, "EVENT_MANAGE");
    if ("error" in auth) return auth.error;
    const value = updateBasics.parse(await request.json());
    await updateEventBasics(id, value);
    const event = await getEventBasics(id);
    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Проверьте обязательные поля", details: error.flatten() }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось сохранить мероприятие" }, { status: 400 });
  }
}
