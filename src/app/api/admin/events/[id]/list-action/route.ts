import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const inputSchema = z.object({
  action: z.enum(["pause", "publish", "soldOut", "available"]),
});

const soldOutMarker = /\n?<!--ATLAS_SOLD_OUT:(?:true|false)-->/g;

function setSoldOut(description: string, soldOut: boolean) {
  const clean = description.replace(soldOutMarker, "").trimEnd();
  return `${clean}\n<!--ATLAS_SOLD_OUT:${soldOut ? "true" : "false"}-->`;
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requirePermission("EVENT_MANAGE");
    if (!actor.organizationId) throw new Error("Организация не настроена");
    const { id } = await context.params;
    const input = inputSchema.parse(await req.json());

    const event = await db.event.findFirst({
      where: { id, organizationId: actor.organizationId },
      select: { id: true, title: true, status: true, description: true },
    });
    if (!event) return NextResponse.json({ error: "Мероприятие не найдено" }, { status: 404 });

    const data = input.action === "pause"
      ? { status: "DRAFT" as const }
      : input.action === "publish"
        ? { status: "PUBLISHED" as const }
        : { description: setSoldOut(event.description, input.action === "soldOut") };

    const updated = await db.event.update({ where: { id }, data, select: { status: true, description: true } });
    await writeAudit({
      actor,
      action: `EVENT_${input.action.toUpperCase()}`,
      entityType: "Event",
      entityId: id,
      summary: `${event.title}: ${input.action}`,
    });

    return NextResponse.json({
      ok: true,
      status: updated.status,
      soldOut: /<!--ATLAS_SOLD_OUT:true-->/.test(updated.description),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось выполнить действие" }, { status: 400 });
  }
}
