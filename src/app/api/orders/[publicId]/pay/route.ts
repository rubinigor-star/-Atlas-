import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ticketCode } from "@/lib/ticketing";
import { sendOrderTicketEmail } from "@/lib/order-email";

const paymentSchema = z.object({
  method: z.enum(["CARD", "APPLE_PAY", "GOOGLE_PAY", "PAYPAL"]),
  cardNumber: z.string().optional(),
});

function validateTestPayment(method: string, cardNumber?: string) {
  if (method !== "CARD") return;
  const digits = (cardNumber || "").replace(/\D/g, "");
  if (digits === "4000000000000002") throw new Error("Тестовый платёж отклонён банком");
  if (digits !== "4242424242424242") throw new Error("Для успешного теста используйте карту 4242 4242 4242 4242");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicId: string }> },
) {
  try {
    const { publicId } = await params;
    const input = paymentSchema.parse(await request.json().catch(() => ({})));
    validateTestPayment(input.method, input.cardNumber);

    let newlyPaid = false;
    const order = await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { publicId },
        include: { items: true, tickets: true },
      });
      if (!current) throw new Error("Заказ не найден");
      if (current.status === "PAID") return current;
      if (current.status !== "AWAITING_PAYMENT") throw new Error("Заказ ещё не одобрен для оплаты");
      if (current.paymentDueAt && current.paymentDueAt < new Date()) throw new Error("Срок оплаты истёк");

      for (const item of current.items) {
        const category = await tx.ticketCategory.findUnique({
          where: { eventId_name: { eventId: current.eventId, name: item.categoryName } },
        });
        if (!category) throw new Error("Категория билета не найдена");
        if (category.sold + item.quantity > category.capacity) throw new Error(`Недостаточно билетов категории ${category.name}`);
        await tx.ticket.createMany({
          data: Array.from({ length: item.quantity }, () => ({
            publicCode: ticketCode(),
            holderName: current.customerName,
            categoryId: category.id,
            orderId: current.id,
          })),
        });
        await tx.ticketCategory.update({ where: { id: category.id }, data: { sold: { increment: item.quantity } } });
        if (item.tableId) await tx.table.update({ where: { id: item.tableId }, data: { reserved: true } });
        if (item.seatId) await tx.seat.update({ where: { id: item.seatId }, data: { status: "RESERVED" } });
      }

      newlyPaid = true;
      return tx.order.update({
        where: { id: current.id },
        data: { status: "PAID" },
        include: { tickets: true },
      });
    });

    let emailSent = false;
    let emailRecipient: string | undefined;
    let emailError: string | undefined;
    if (newlyPaid) {
      try {
        const email = await sendOrderTicketEmail(order.publicId);
        emailSent = true;
        emailRecipient = email.recipient;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Неизвестная ошибка отправки";
      }
    }

    return NextResponse.json({ status: order.status, orderId: order.publicId, emailSent, emailRecipient, emailError });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ошибка оплаты" }, { status: 400 });
  }
}
