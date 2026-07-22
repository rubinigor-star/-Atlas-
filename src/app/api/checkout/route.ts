import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkoutSchema } from "@/lib/schemas";
import { initialOrderStatus, orderNumber, seatingSelectionTotal, ticketCode } from "@/lib/ticketing";

export async function POST(req: Request) {
  try {
    const input = checkoutSchema.parse(await req.json());
    const existing = await db.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) return NextResponse.json({ orderId: existing.publicId });

    const order = await db.$transaction(async (tx) => {
      const event = await tx.event.findUnique({ where: { id: input.eventId } });
      if (!event || event.status !== "PUBLISHED") {
        throw new Error("Мероприятие недоступно для продажи");
      }
      const category = await tx.ticketCategory.findUnique({
        where: { id: input.categoryId },
      });
      if (!category || category.eventId !== input.eventId) {
        throw new Error("Категория не найдена");
      }

      const table = input.tableId
        ? await tx.table.findUnique({
            where: { id: input.tableId },
            include: { zone: true },
          })
        : null;
      if (table && table.zone.eventId !== input.eventId) {
        throw new Error("Стол не относится к событию");
      }
      if (table?.reserved) throw new Error("Этот стол уже занят");
      if (table && (table.priceMode !== "WHOLE_TABLE" || table.categoryId !== category.id)) {
        throw new Error("Этот объект нельзя купить целиком по выбранному тарифу");
      }

      const seats = input.seatIds?.length
        ? await tx.seat.findMany({
            where: { id: { in: input.seatIds } },
            include: { table: { include: { zone: true } } },
          })
        : [];
      if (input.seatIds?.length && seats.length !== input.seatIds.length) {
        throw new Error("Некоторые выбранные места не найдены");
      }
      if (seats.some((seat) => seat.table.zone.eventId !== input.eventId || seat.table.categoryId !== category.id)) {
        throw new Error("Место не относится к выбранному мероприятию или тарифу");
      }
      if (seats.some((seat) => seat.table.priceMode !== "PER_SEAT")) {
        throw new Error("Этот объект продаётся только целиком");
      }
      if (seats.some((seat) => seat.status !== "AVAILABLE")) {
        throw new Error("Одно из выбранных мест уже занято");
      }
      if (new Set(seats.map((seat) => seat.tableId)).size > 1) {
        throw new Error("Выберите места за одним столом или диваном");
      }
      if (table && seats.length) throw new Error("Нельзя одновременно выбрать объект целиком и отдельные места");

      const quantity = table ? table.seats : seats.length || input.quantity;
      if (category.sold + quantity > category.capacity) {
        throw new Error("Недостаточно доступных билетов");
      }

      let discount = 0;
      if (input.promoCode) {
        const promo = await tx.promoCode.findUnique({
          where: {
            eventId_code: {
              eventId: input.eventId,
              code: input.promoCode.toUpperCase(),
            },
          },
        });
        if (promo?.active) discount = promo.discountPercent;
      }

      const subtotal = table
        ? seatingSelectionTotal("WHOLE_TABLE", table.priceMinor, quantity)
        : seats[0]
          ? seatingSelectionTotal("PER_SEAT", seats[0].table.priceMinor, quantity)
          : category.priceMinor * quantity;
      const total = Math.round((subtotal * (100 - discount)) / 100);
      const referral = input.referralCode
        ? await tx.referral.findUnique({ where: { code: input.referralCode } })
        : null;

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
          referralId: referral?.id,
          items: {
            create: seats.length
              ? seats.map((seat) => ({
                  quantity: 1,
                  unitPriceMinor: seat.table.priceMinor,
                  categoryName: category.name,
                  tableId: seat.tableId,
                  seatId: seat.id,
                }))
              : [{
                  quantity,
                  unitPriceMinor: table ? Math.round(table.priceMinor / quantity) : category.priceMinor,
                  categoryName: category.name,
                  tableId: table?.id,
                }],
          },
          tickets:
            event.salesMode === "INSTANT"
              ? {
                  create: Array.from({ length: quantity }, () => ({
                    publicCode: ticketCode(),
                    holderName: input.customer.name,
                    categoryId: category.id,
                  })),
                }
              : undefined,
        },
      });

      if (event.salesMode === "INSTANT") {
        await tx.ticketCategory.update({
          where: { id: category.id },
          data: { sold: { increment: quantity } },
        });
      }
      if (event.salesMode === "INSTANT" && table) {
        const claimed = await tx.table.updateMany({
          where: { id: table.id, reserved: false },
          data: { reserved: true },
        });
        if (claimed.count !== 1) {
          throw new Error("Этот стол только что был забронирован");
        }
      }
      if (event.salesMode === "INSTANT" && seats.length) {
        const claimed = await tx.seat.updateMany({
          where: { id: { in: seats.map((seat) => seat.id) }, status: "AVAILABLE" },
          data: { status: "RESERVED" },
        });
        if (claimed.count !== seats.length) throw new Error("Одно из мест только что было забронировано");
      }
      return created;
    });

    return NextResponse.json(
      { orderId: order.publicId, status: order.status },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Некорректный запрос";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
