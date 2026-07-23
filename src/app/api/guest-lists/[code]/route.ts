import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isGuestListPromoter, verifyGuestManagementToken } from "@/lib/guest-links";
import { orderNumber, ticketCode } from "@/lib/ticketing";

const addSchema = z.object({
  action: z.literal("add"),
  token: z.string().min(10),
  name: z.string().min(2).max(120),
  phone: z.string().min(7).max(40),
  email: z.string().email().optional().or(z.literal("")),
});
const removeSchema = z.object({ action: z.literal("remove"), token: z.string().min(10), orderId: z.string().min(1) });
const visitSchema = z.object({ action: z.literal("visit"), sessionId: z.string().min(8).max(100) });

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params;
    const body = await req.json();
    const link = await db.promoterLink.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        promoter: true,
        event: true,
        category: true,
        table: { include: { category: true } },
        orders: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } }, include: { items: true, tickets: true } },
      },
    });
    if (!link || !link.active || !isGuestListPromoter(link.promoter.name)) throw new Error("Гостевой список не найден");

    if (body.action === "visit") {
      const input = visitSchema.parse(body);
      await db.promoterLinkVisit.upsert({
        where: { linkId_sessionId: { linkId: link.id, sessionId: input.sessionId } },
        update: {},
        create: { linkId: link.id, sessionId: input.sessionId, userAgent: req.headers.get("user-agent") },
      });
      return NextResponse.json({ ok: true });
    }

    if (!verifyGuestManagementToken(link.id, String(body.token || ""))) throw new Error("Ссылка управления недействительна");

    if (body.action === "add") {
      const input = addSchema.parse(body);
      const category = link.category ?? link.table?.category;
      if (!category || category.priceMinor !== 0) throw new Error("Для списка не назначен бесплатный билет");
      const used = link.orders.flatMap((order) => order.items).reduce((sum, item) => sum + item.quantity, 0);
      const limit = link.guestLimit ?? link.table?.seats ?? category.capacity;
      if (used >= limit) throw new Error("Лимит гостей исчерпан");
      if (category.sold >= category.capacity) throw new Error("Бесплатные билеты закончились");

      const order = await db.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            publicId: orderNumber(),
            idempotencyKey: randomUUID(),
            customerName: input.name,
            customerPhone: input.phone,
            customerEmail: input.email || `guest-${randomUUID()}@guest.atlas.local`,
            totalMinor: 0,
            currency: category.currency,
            status: "PAID",
            eventId: link.eventId,
            promoterLinkId: link.id,
            items: { create: [{ quantity: 1, unitPriceMinor: 0, categoryName: category.name, tableId: link.tableId }] },
            tickets: { create: [{ publicCode: ticketCode(), holderName: input.name, categoryId: category.id }] },
          },
          include: { tickets: true },
        });
        await tx.ticketCategory.update({ where: { id: category.id }, data: { sold: { increment: 1 } } });
        return created;
      });
      return NextResponse.json({ ok: true, orderId: order.id }, { status: 201 });
    }

    if (body.action === "remove") {
      const input = removeSchema.parse(body);
      const order = link.orders.find((item) => item.id === input.orderId);
      if (!order) throw new Error("Гость не найден");
      if (order.tickets.some((ticket) => ticket.status === "USED")) throw new Error("Нельзя удалить гостя после прохода");
      const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
      const category = link.category ?? link.table?.category;
      await db.$transaction(async (tx) => {
        await tx.ticket.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
        await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
        if (category) await tx.ticketCategory.update({ where: { id: category.id }, data: { sold: { decrement: quantity } } });
      });
      return NextResponse.json({ ok: true });
    }

    throw new Error("Неизвестное действие");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
