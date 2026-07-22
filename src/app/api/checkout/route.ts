import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkoutSchema } from "@/lib/schemas";
import { initialOrderStatus, orderNumber, ticketCode } from "@/lib/ticketing";

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

      const quantity = table ? table.seats : input.quantity;
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

      const subtotal = table?.priceMinor ?? category.priceMinor * quantity;
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
            create: {
              quantity,
              unitPriceMinor: table
                ? Math.round(table.priceMinor / quantity)
                : category.priceMinor,
              categoryName: category.name,
              tableId: table?.id,
            },
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
