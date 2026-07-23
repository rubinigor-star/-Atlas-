import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkoutSchema } from "@/lib/schemas";
import { effectiveTicketPrice, initialOrderStatus, orderNumber, ticketCode } from "@/lib/ticketing";

export async function POST(req: Request) {
  try {
    const input = checkoutSchema.parse(await req.json());
    const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return NextResponse.json({ orderId: existing.publicId });

    const order = await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: input.eventId } });
      if (!event || event.status !== "PUBLISHED") throw new Error("Мероприятие недоступно для продажи");

      const category = await tx.ticketCategory.findUnique({ where: { id: input.categoryId }, include: { priceTiers: true } });
      if (!category || category.eventId !== input.eventId) throw new Error("Категория не найдена");
      if (category.hidden) throw new Error("Этот тариф недоступен");
      const categoryPrice = effectiveTicketPrice(category);

      const table = input.tableId ? await tx.table.findUnique({ where: { id: input.tableId }, include: { zone: true, category: { include: { priceTiers: true } } } }) : null;
      if (table && table.zone.eventId !== input.eventId) throw new Error("Стол не относится к событию");
      if (table?.reserved) throw new Error("Этот стол уже занят");
      if (table && (table.priceMode !== "WHOLE_TABLE" || !table.category)) throw new Error("Для этого объекта не назначен билет для продажи целиком");

      const seats = input.seatIds?.length ? await tx.seat.findMany({ where: { id: { in: input.seatIds } }, include: { category: { include: { priceTiers: true } }, table: { include: { zone: true } } } }) : [];
      if (input.seatIds?.length && seats.length !== input.seatIds.length) throw new Error("Некоторые выбранные места не найдены");
      if (seats.some((seat) => seat.table.zone.eventId !== input.eventId || !seat.category)) throw new Error("Место не относится к мероприятию или для него не назначен билет");
      if (seats.some((seat) => seat.table.priceMode !== "PER_SEAT")) throw new Error("Этот объект продаётся только целиком");
      if (seats.some((seat) => seat.status !== "AVAILABLE")) throw new Error("Одно из выбранных мест уже занято");
      if (table && seats.length) throw new Error("Нельзя одновременно выбрать объект целиком и отдельные места");

      const promoterLink = input.referralCode ? await tx.promoterLink.findUnique({
        where: { code: input.referralCode.toUpperCase() },
        include: { orders: { where: { status: { notIn: ["CANCELLED", "REJECTED"] } }, include: { items: true } } },
      }) : null;
      const legacyReferral = input.referralCode && !promoterLink ? await tx.referral.findUnique({ where: { code: input.referralCode } }) : null;
      const now = new Date();
      if (input.referralCode && !promoterLink && !legacyReferral) throw new Error("Персональная ссылка недействительна");
      if (promoterLink) {
        if (!promoterLink.active || promoterLink.eventId !== input.eventId || (promoterLink.startsAt && promoterLink.startsAt > now) || (promoterLink.endsAt && promoterLink.endsAt < now)) throw new Error("Персональная ссылка больше недоступна");
        if (promoterLink.allocationType === "TABLE" && promoterLink.tableId !== table?.id) throw new Error("Эта ссылка предназначена для другого стола");
        if (promoterLink.allocationType === "CATEGORY" && promoterLink.categoryId !== category.id) throw new Error("Эта ссылка предназначена для другой категории");
      }

      if (!promoterLink) {
        if (table) {
          const locked = await tx.promoterLink.findFirst({ where: { eventId: input.eventId, tableId: table.id, allocationType: "TABLE", exclusive: true, active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] } });
          if (locked) throw new Error("Этот стол доступен только по персональной ссылке промоутера");
        } else {
          const locked = await tx.promoterLink.findFirst({ where: { eventId: input.eventId, categoryId: category.id, allocationType: "CATEGORY", exclusive: true, active: true, OR: [{ startsAt: null }, { startsAt: { lte: now } }], AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }] } });
          if (locked) throw new Error("Эта категория доступна только по персональной ссылке промоутера");
        }
      }

      const quantity = table ? table.seats : seats.length || input.quantity;
      if (!table && !seats.length && (quantity < category.minPerOrder || quantity > category.maxPerOrder)) throw new Error(`В одном заказе можно выбрать от ${category.minPerOrder} до ${category.maxPerOrder} билетов`);
      if (promoterLink && quantity > promoterLink.maxPerOrder) throw new Error(`По этой ссылке можно купить не более ${promoterLink.maxPerOrder} билетов за заказ`);
      if (promoterLink?.guestLimit) {
        const alreadyAllocated = promoterLink.orders.flatMap((item) => item.items).reduce((sum, item) => sum + item.quantity, 0);
        if (alreadyAllocated + quantity > promoterLink.guestLimit) throw new Error("Квота этой персональной ссылки исчерпана");
      }

      const requested = new Map<string, { category: typeof category; quantity: number; price: number }>();
      if (table?.category) requested.set(table.category.id, { category: table.category, quantity: table.seats, price: effectiveTicketPrice(table.category) });
      else if (seats.length) for (const seat of seats) {
        const assigned = seat.category!;
        const current = requested.get(assigned.id);
        requested.set(assigned.id, { category: assigned, quantity: (current?.quantity ?? 0) + 1, price: effectiveTicketPrice(assigned) });
      } else requested.set(category.id, { category, quantity, price: categoryPrice });
      for (const item of requested.values()) if (item.category.hidden || item.category.sold + item.quantity > item.category.capacity) throw new Error(`Недостаточно доступных билетов ${item.category.name}`);

      let discount = 0;
      if (input.promoCode) {
        const promo = await tx.promoCode.findUnique({ where: { eventId_code: { eventId: input.eventId, code: input.promoCode.toUpperCase() } } });
        if (promo?.active) discount = promo.discountPercent;
      }

      const standardSubtotal = [...requested.values()].reduce((sum, item) => sum + item.price * (table ? 1 : item.quantity), 0);
      const promoterSubtotal = promoterLink?.customPriceMinor ? (promoterLink.allocationType === "TABLE" ? promoterLink.customPriceMinor : promoterLink.customPriceMinor * quantity) : null;
      const subtotal = promoterSubtotal ?? standardSubtotal;
      const total = Math.round((subtotal * (100 - discount)) / 100);

      const created = await tx.order.create({
        data: {
          publicId: orderNumber(),
          idempotencyKey: input.idempotencyKey,
          customerName: input.customer.name,
          customerEmail: input.customer.email,
          customerPhone: input.customer.phone,
          eligibilityAnswer: input.eligibilityAnswer || null,
          totalMinor: total,
          status: initialOrderStatus(event.salesMode),
          eventId: input.eventId,
          referralId: legacyReferral?.id,
          promoterLinkId: promoterLink?.id,
          items: {
            create: seats.length ? seats.map((seat) => ({ quantity: 1, unitPriceMinor: promoterLink?.customPriceMinor ?? effectiveTicketPrice(seat.category!), categoryName: seat.category!.name, tableId: seat.tableId, seatId: seat.id })) : [{ quantity, unitPriceMinor: promoterLink?.customPriceMinor ? (promoterLink.allocationType === "TABLE" ? Math.round(promoterLink.customPriceMinor / quantity) : promoterLink.customPriceMinor) : table?.category ? Math.round(effectiveTicketPrice(table.category) / quantity) : categoryPrice, categoryName: table?.category?.name ?? category.name, tableId: table?.id }],
          },
          tickets: event.salesMode === "INSTANT" ? { create: seats.length ? seats.map((seat) => ({ publicCode: ticketCode(), holderName: input.customer.name, categoryId: seat.category!.id })) : Array.from({ length: quantity }, () => ({ publicCode: ticketCode(), holderName: input.customer.name, categoryId: table?.category?.id ?? category.id })) } : undefined,
        },
      });

      if (event.salesMode === "INSTANT") for (const item of requested.values()) await tx.ticketCategory.update({ where: { id: item.category.id }, data: { sold: { increment: item.quantity } } });
      if (event.salesMode === "INSTANT" && table) {
        const claimed = await tx.table.updateMany({ where: { id: table.id, reserved: false }, data: { reserved: true } });
        if (claimed.count !== 1) throw new Error("Этот стол только что был забронирован");
      }
      if (event.salesMode === "INSTANT" && seats.length) {
        const claimed = await tx.seat.updateMany({ where: { id: { in: seats.map((seat) => seat.id) }, status: "AVAILABLE" }, data: { status: "RESERVED" } });
        if (claimed.count !== seats.length) throw new Error("Одно из мест только что было забронировано");
      }
      return created;
    });

    return NextResponse.json({ orderId: order.publicId, status: order.status }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Некорректный запрос";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
