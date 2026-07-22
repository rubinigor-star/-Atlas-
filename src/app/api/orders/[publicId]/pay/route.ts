import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ticketCode } from "@/lib/ticketing";

export async function POST(
  _: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const order = await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { publicId },
        include: { items: true, tickets: true },
      });
      if (!current) throw new Error("Заказ не найден");
      if (current.status === "PAID") return current;
      if (current.status !== "AWAITING_PAYMENT") {
        throw new Error("Заказ ещё не одобрен для оплаты");
      }
      if (current.paymentDueAt && current.paymentDueAt < new Date()) {
        throw new Error("Срок оплаты истёк");
      }

      for (const item of current.items) {
        const category = await tx.ticketCategory.findUnique({
          where: {
            eventId_name: {
              eventId: current.eventId,
              name: item.categoryName,
            },
          },
        });
        if (!category) throw new Error("Категория билета не найдена");
        await tx.ticket.createMany({
          data: Array.from({ length: item.quantity }, () => ({
            publicCode: ticketCode(),
            holderName: current.customerName,
            categoryId: category.id,
            orderId: current.id,
          })),
        });
      }

      return tx.order.update({
        where: { id: current.id },
        data: { status: "PAID" },
        include: { tickets: true },
      });
    });

    return NextResponse.json({ status: order.status, orderId: order.publicId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка оплаты" },
      { status: 400 },
    );
  }
}
