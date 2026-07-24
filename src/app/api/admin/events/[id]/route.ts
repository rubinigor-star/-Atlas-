import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { notifyWalletTickets } from "@/lib/wallet-push";
import { withEventMedia } from "@/lib/event-media";
import { parseEventRejectionMessage, withEventRejectionMessage } from "@/lib/event-approval-message";

const mediaItem = z.object({ type: z.enum(["VIDEO", "LINK"]), url: z.string().url(), title: z.string().max(120).optional() });
const update = z.object({ action: z.literal("update"), title: z.string().min(3), description: z.string().min(20), startsAt: z.string().datetime(), media: z.array(mediaItem).max(20).default([]) });
const status = z.object({ action: z.literal("status"), status: z.enum(["DRAFT", "PUBLISHED"]) });
const sales = z.object({ action: z.literal("sales"), salesMode: z.enum(["INSTANT", "APPROVAL_REQUIRED"]), approvalInstructions: z.string().max(1000).optional(), rejectionMessage: z.string().min(20).max(2000).optional() });
const admission = z.object({ action: z.literal("admission"), mapEnabled: z.boolean() });
const category = z.object({ action: z.literal("category"), name: z.string().min(2), description: z.string().max(500).optional(), priceMinor: z.number().int().nonnegative(), colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#2563EB"), capacity: z.number().int().positive(), pricingMode: z.enum(["FIXED", "SCHEDULED"]).default("FIXED"), salesStart: z.string().datetime().optional(), salesEnd: z.string().datetime().optional(), earlyBirdPriceMinor: z.number().int().nonnegative().optional(), earlyBirdEndsAt: z.string().datetime().optional(), maxPerOrder: z.number().int().min(1).max(20).default(10) });
const table = z.object({ action: z.literal("table"), zoneName: z.string().min(2), label: z.string().min(1), seats: z.number().int().positive(), priceMinor: z.number().int().nonnegative() });
const layout = z.object({ action: z.literal("layout"), objects: z.array(z.object({ id: z.string().optional(), label: z.string().min(1).max(30), objectType: z.enum(["TABLE", "ROUND_TABLE", "SOFA", "ROW", "ZONE", "STAGE", "BAR", "TEXT"]), seats: z.number().int().min(0).max(50), priceMode: z.enum(["WHOLE_TABLE", "PER_SEAT"]), priceMinor: z.number().int().min(0), x: z.number().int().min(0).max(100), y: z.number().int().min(0).max(100), rotation: z.number().int().min(0).max(359), width: z.number().int().min(40).max(800), height: z.number().int().min(30).max(600), categoryId: z.string().min(1).nullable(), seatAssignments: z.array(z.object({ position: z.number().int().min(1).max(50), categoryId: z.string().min(1).nullable() })).max(50).default([]) })).min(1).max(300) });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const ticketActions = new Set(["category", "table", "layout"]);
    const actor = await requireEventAccess(ticketActions.has(body.action) ? "TICKET_MANAGE" : "EVENT_MANAGE", id);

    if (body.action === "update") {
      const value = update.parse(body);
      const current = await db.event.findUniqueOrThrow({ where: { id }, select: { description: true } });
      const rejectionMessage = parseEventRejectionMessage(current.description);
      const description = withEventRejectionMessage(withEventMedia(value.description, value.media), rejectionMessage);
      await db.event.update({ where: { id }, data: { title: value.title, description, startsAt: new Date(value.startsAt) } });
      const walletTickets = await db.ticket.findMany({ where: { order: { eventId: id } }, select: { id: true } });
      await db.ticket.updateMany({ where: { id: { in: walletTickets.map((ticket) => ticket.id) } }, data: { walletUpdatedAt: new Date() } });
      await notifyWalletTickets(walletTickets.map((ticket) => ticket.id));
    } else if (body.action === "status") {
      const value = status.parse(body);
      await db.event.update({ where: { id }, data: { status: value.status } });
    } else if (body.action === "sales") {
      const value = sales.parse(body);
      const current = await db.event.findUniqueOrThrow({ where: { id }, select: { description: true } });
      const description = withEventRejectionMessage(current.description, value.rejectionMessage || parseEventRejectionMessage(current.description));
      await db.event.update({ where: { id }, data: { salesMode: value.salesMode, approvalInstructions: value.approvalInstructions || null, description } });
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
      if (value.pricingMode === "SCHEDULED" && (value.earlyBirdPriceMinor === undefined || !value.earlyBirdEndsAt)) throw new Error("Заполните раннюю цену и дату её окончания");
      const earlyEnd = value.earlyBirdEndsAt ? new Date(value.earlyBirdEndsAt) : null;
      if (earlyEnd && (earlyEnd <= salesStart || earlyEnd >= salesEnd)) throw new Error("Дата смены цены должна находиться внутри периода продаж");
      await db.ticketCategory.create({ data: { eventId: id, name: value.name, description: value.description || null, priceMinor: value.priceMinor, colorHex: value.colorHex, pricingMode: value.pricingMode, capacity: value.capacity, salesStart, salesEnd, maxPerOrder: value.maxPerOrder, priceTiers: value.pricingMode === "SCHEDULED" && earlyEnd && value.earlyBirdPriceMinor !== undefined ? { create: [{ label: "Early bird", priceMinor: value.earlyBirdPriceMinor, startsAt: salesStart, endsAt: earlyEnd }, { label: "Regular", priceMinor: value.priceMinor, startsAt: earlyEnd, endsAt: salesEnd }] } : undefined } });
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
        if (value.objects.some((item) => item.categoryId && !categoryIds.has(item.categoryId)) || value.objects.some((item) => item.seatAssignments.some((seat) => seat.categoryId && !categoryIds.has(seat.categoryId)))) throw new Error("Категория билета не относится к этому мероприятию");
        if (value.objects.some((item) => sellableTypes.has(item.objectType) && item.seats < 1)) throw new Error("Для продаваемого объекта нужно хотя бы одно место");
        const existing = await tx.table.findMany({ where: { zone: { eventId: id } }, include: { seatItems: true, orderItems: true } });
        if (existing.some((item) => item.reserved || item.orderItems.length > 0 || item.seatItems.some((seat) => seat.status !== "AVAILABLE"))) throw new Error("Карту нельзя полностью перестроить после появления заказов. Создайте новую версию карты до открытия продаж.");
        await tx.seat.deleteMany({ where: { table: { zone: { eventId: id } } } });
        await tx.table.deleteMany({ where: { zone: { eventId: id } } });
        let zone = await tx.zone.findUnique({ where: { eventId_name: { eventId: id, name: "Основной зал" } } });
        zone ??= await tx.zone.create({ data: { eventId: id, name: "Основной зал" } });
        for (const item of value.objects) await tx.table.create({ data: { zoneId: zone.id, label: item.label, objectType: item.objectType, seats: item.seats, priceMode: item.priceMode, priceMinor: item.priceMinor, x: item.x, y: item.y, rotation: item.rotation, width: item.width, height: item.height, categoryId: item.categoryId, seatItems: { create: Array.from({ length: sellableTypes.has(item.objectType) ? item.seats : 0 }, (_, index) => ({ label: `${item.label}-${index + 1}`, position: index + 1, categoryId: item.seatAssignments.find((seat) => seat.position === index + 1)?.categoryId ?? (item.priceMode === "PER_SEAT" ? item.categoryId : null) })) } } });
        await tx.event.update({ where: { id }, data: { mapEnabled: true } });
      });
    } else throw new Error("Unknown action");

    await writeAudit(actor, { action: `EVENT_${String(body.action).toUpperCase()}`, entityType: "Event", entityId: id, summary: `Обновлены настройки мероприятия: ${body.action}` });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message === "FORBIDDEN" ? "Недостаточно прав" : message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
