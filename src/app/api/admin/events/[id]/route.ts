import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const update = z.object({ action: z.literal("update"), title: z.string().min(3), description: z.string().min(20), startsAt: z.string().datetime() });
const status = z.object({ action: z.literal("status"), status: z.enum(["DRAFT", "PUBLISHED"]) });
const sales = z.object({ action: z.literal("sales"), salesMode: z.enum(["INSTANT", "APPROVAL_REQUIRED"]), approvalInstructions: z.string().max(1000).optional() });
const category = z.object({ action: z.literal("category"), name: z.string().min(2), priceMinor: z.number().int().positive(), capacity: z.number().int().positive() });
const table = z.object({ action: z.literal("table"), zoneName: z.string().min(2), label: z.string().min(1), seats: z.number().int().positive(), priceMinor: z.number().int().positive() });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    if (body.action === "update") {
      const value = update.parse(body);
      await db.event.update({ where: { id }, data: { title: value.title, description: value.description, startsAt: new Date(value.startsAt) } });
    } else if (body.action === "status") {
      const value = status.parse(body);
      await db.event.update({ where: { id }, data: { status: value.status } });
    } else if (body.action === "sales") {
      const value = sales.parse(body);
      await db.event.update({ where: { id }, data: { salesMode: value.salesMode, approvalInstructions: value.approvalInstructions || null } });
    } else if (body.action === "category") {
      const value = category.parse(body);
      await db.ticketCategory.create({ data: { eventId: id, name: value.name, priceMinor: value.priceMinor, capacity: value.capacity } });
    } else if (body.action === "table") {
      const value = table.parse(body);
      let zone = await db.zone.findUnique({ where: { eventId_name: { eventId: id, name: value.zoneName } } });
      zone ??= await db.zone.create({ data: { eventId: id, name: value.zoneName } });
      await db.table.create({ data: { zoneId: zone.id, label: value.label, seats: value.seats, priceMinor: value.priceMinor } });
    } else {
      throw new Error("Unknown action");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 400 });
  }
}
