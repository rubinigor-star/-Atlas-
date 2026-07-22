import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const update = z.object({ action: z.literal("update"), title: z.string().min(3), description: z.string().min(20), startsAt: z.string().datetime() });
const status = z.object({ action: z.literal("status"), status: z.enum(["DRAFT", "PUBLISHED"]) });
const sales = z.object({ action: z.literal("sales"), salesMode: z.enum(["INSTANT", "APPROVAL_REQUIRED"]), approvalInstructions: z.string().max(1000).optional() });
const admission = z.object({ action: z.literal("admission"), mapEnabled: z.boolean() });
const category = z.object({ action: z.literal("category"), name: z.string().min(2), description: z.string().max(500).optional(), priceMinor: z.number().int().positive(), capacity: z.number().int().positive(), pricingMode: z.enum(["FIXED", "SCHEDULED"]).default("FIXED"), salesStart: z.string().datetime().optional(), salesEnd: z.string().datetime().optional(), earlyBirdPriceMinor: z.number().int().positive().optional(), earlyBirdEndsAt: z.string().datetime().optional(), maxPerOrder: z.number().int().min(1).max(20).default(10) });
const table = z.object({ action: z.literal("table"), zoneName: z.string().min(2), label: z.string().min(1), seats: z.number().int().positive(), priceMinor: z.number().int().positive() });
const layout = z.object({
  action: z.literal("layout"),
  objects: z.array(z.object({
    id: z.string().optional(),
    label: z.string().min(1).max(30),
    objectType: z.enum(["TABLE", "ROUND_TABLE", "SOFA", "ROW", "ZONE", "STAGE", "BAR", "TEXT"]),
    seats: z.number().int().min(0).max(50),
    priceMode: z.enum(["WHOLE_TABLE", "PER_SEAT"]),
    priceMinor: z.number().int().min(0),
    x: z.number().int().min(0).max(100),
    y: z.number().int().min(0).max(100),
    rotation: z.number().int().min(0).max(359),
    width: z.number().int().min(40).max(800),
    height: z.number().int().min(30).max(600),
    categoryId: z.string().min(1).nullable(),
  })).min(1).max(300),
});

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
    } else if (body.action === "admission") {
      const value = admission.parse(body);
      const sold = await db.order.count({ where: { eventId: id } });
      if (sold) throw new Error("Нельзя менять тип выбора билетов после появления заказов");
      await db.event.update({ where: { id }, data: { mapEnabled: value.mapEnabled } });
    } else if (body.action === "category") {
      const value = category.parse(body);
      const parent = await db.event.findUniqueOrThrow({ where: { id } });
      const salesStart = value.salesStart ? new Date(value.salesStart) : parent.salesStart;
      const salesEnd = value.salesEnd ? new Date(value.salesEnd) : parent.salesEnd;
      if (salesStart >= salesEnd) throw new Error("Начало продаж должно быть раньше окончания");
      if (value.pricingMode === "SCHEDULED" && (!value.earlyBirdPriceMinor || !value.earlyBirdEndsAt)) throw new Error("Заполните раннюю цену и дату её окончания");
      const earlyEnd = value.earlyBirdEndsAt ? new Date(value.earlyBirdEndsAt) : null;
      if (earlyEnd && (earlyEnd <= salesStart || earlyEnd >= salesEnd)) throw new Error("Дата смены цены должна находиться внутри периода продаж");
      await db.ticketCategory.create({ data: { eventId: id, name: value.name, description: value.description || null, priceMinor: value.priceMinor, pricingMode: value.pricingMode, capacity: value.capacity, salesStart, salesEnd, maxPerOrder: value.maxPerOrder, priceTiers: value.pricingMode === "SCHEDULED" && earlyEnd && value.earlyBirdPriceMinor ? { create: [{ label: "Early bird", priceMinor: value.earlyBirdPriceMinor, startsAt: salesStart, endsAt: earlyEnd }, { label: "Regular", priceMinor: value.priceMinor, startsAt: earlyEnd, endsAt: salesEnd }] } : undefined } });
    } else if (body.action === "table") {
      const value = table.parse(body);
      let zone = await db.zone.findUnique({ where: { eventId_name: { eventId: id, name: value.zoneName } } });
      zone ??= await db.zone.create({ data: { eventId: id, name: value.zoneName } });
      await db.table.create({ data: { zoneId: zone.id, label: value.label, seats: value.seats, priceMinor: value.priceMinor } });
    } else if (body.action === "layout") {
      const value = layout.parse(body);
      await db.$transaction(async (tx) => {
        const categories = await tx.ticketCategory.findMany({ where: { eventId: id }, select: { id: true } });
        const categoryIds = new Set(categories.map((item) => item.id));
        const sellableTypes = new Set(["TABLE", "ROUND_TABLE", "SOFA", "ROW"]);
        if (value.objects.some((item) => item.categoryId && !categoryIds.has(item.categoryId))) {
          throw new Error("Категория билета не относится к этому мероприятию");
        }
        if (value.objects.some((item) => sellableTypes.has(item.objectType) && (!item.categoryId || item.seats < 1 || item.priceMinor < 1))) {
          throw new Error("Для продаваемого объекта нужны места, категория билета и цена");
        }
        const existing = await tx.table.findMany({
          where: { zone: { eventId: id } },
          include: { seatItems: true, orderItems: true },
        });
        if (existing.some((item) => item.reserved || item.orderItems.length > 0 || item.seatItems.some((seat) => seat.status !== "AVAILABLE"))) {
          throw new Error("Карту нельзя полностью перестроить после появления заказов. Создайте новую версию карты до открытия продаж.");
        }
        await tx.seat.deleteMany({ where: { table: { zone: { eventId: id } } } });
        await tx.table.deleteMany({ where: { zone: { eventId: id } } });
        let zone = await tx.zone.findUnique({ where: { eventId_name: { eventId: id, name: "Основной зал" } } });
        zone ??= await tx.zone.create({ data: { eventId: id, name: "Основной зал" } });
        for (const item of value.objects) {
          await tx.table.create({
            data: {
              zoneId: zone.id,
              label: item.label,
              objectType: item.objectType,
              seats: item.seats,
              priceMode: item.priceMode,
              priceMinor: item.priceMinor,
              x: item.x,
              y: item.y,
              rotation: item.rotation,
              width: item.width,
              height: item.height,
              categoryId: item.categoryId,
              seatItems: {
                create: Array.from({ length: sellableTypes.has(item.objectType) ? item.seats : 0 }, (_, index) => ({
                  label: `${item.label}-${index + 1}`,
                  position: index + 1,
                })),
              },
            },
          });
        }
        await tx.event.update({ where: { id }, data: { mapEnabled: true } });
      });
    } else {
      throw new Error("Unknown action");
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка" }, { status: 400 });
  }
}
