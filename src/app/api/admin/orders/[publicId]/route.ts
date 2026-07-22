import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const input = reviewSchema.parse(await req.json());

    const order = await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { publicId },
        include: { items: { include: { table: true, seat: true } } },
      });
      if (!current) throw new Error("Заявка не найдена");
      if (current.status !== "PENDING_APPROVAL") {
        throw new Error("Эта заявка уже рассмотрена");
      }

      if (input.action === "reject") {
        return tx.order.update({
          where: { id: current.id },
          data: {
            status: "REJECTED",
            reviewNote: input.note || null,
            reviewedAt: new Date(),
          },
        });
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
        if (!category || category.sold + item.quantity > category.capacity) {
          throw new Error(`Недостаточно мест в категории ${item.categoryName}`);
        }
        if (item.seatId) {
          const claimed = await tx.seat.updateMany({
            where: { id: item.seatId, status: "AVAILABLE" },
            data: { status: "RESERVED" },
          });
          if (claimed.count !== 1) throw new Error("Выбранное место уже занято");
        } else if (item.tableId) {
          const claimed = await tx.table.updateMany({
            where: { id: item.tableId, reserved: false },
            data: { reserved: true },
          });
          if (claimed.count !== 1) throw new Error("Выбранный стол уже занят");
        }
        await tx.ticketCategory.update({
          where: { id: category.id },
          data: { sold: { increment: item.quantity } },
        });
      }

      return tx.order.update({
        where: { id: current.id },
        data: {
          status: "AWAITING_PAYMENT",
          reviewNote: input.note || null,
          reviewedAt: new Date(),
          paymentDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    return NextResponse.json({ status: order.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка проверки заявки" },
      { status: 400 },
    );
  }
}
