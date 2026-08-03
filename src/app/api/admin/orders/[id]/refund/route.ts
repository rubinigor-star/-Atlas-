import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { refundHypTransaction } from "@/lib/hyp-refund";
import { notifyWalletTickets } from "@/lib/wallet-push";

const schema = z.object({
  reason: z.string().trim().min(3, "Укажите причину возврата").max(500),
});

type AuthorizationRow = {
  id: string;
  providerReference: string;
  amountMinor: number;
  status: string;
  cardLast4: string | null;
};

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let authorizationId = "";

  try {
    const actor = await requirePermission("ORDER_MANAGE");
    const input = schema.parse(await req.json());
    const order = await db.order.findUnique({
      where: { publicId: id },
      include: { items: true, tickets: true, event: true },
    });

    if (!order || order.event.organizationId !== actor.organizationId) {
      throw new Error("Заказ не найден");
    }
    if (order.status !== "PAID") {
      throw new Error("Возврат возможен только для оплаченного заказа");
    }

    const rows = await db.$queryRaw<AuthorizationRow[]>`
      SELECT id, "providerReference", "amountMinor", status, "cardLast4"
      FROM "PaymentAuthorization"
      WHERE "orderId"=${order.id} AND provider='HYP'
      LIMIT 1
    `;
    const authorization = rows[0];
    if (!authorization) throw new Error("Для заказа не найдена транзакция HYP");
    if (authorization.status === "REFUNDED") throw new Error("Этот заказ уже возвращён");
    if (authorization.status === "REFUND_PENDING") {
      throw new Error("Возврат уже обрабатывается. Не отправляйте его повторно");
    }
    if (authorization.status !== "CAPTURED") {
      throw new Error(`Транзакция недоступна для возврата: ${authorization.status}`);
    }
    if (!authorization.providerReference) {
      throw new Error("У исходной оплаты отсутствует TransId HYP");
    }

    authorizationId = authorization.id;
    const locked = await db.$executeRaw`
      UPDATE "PaymentAuthorization"
      SET status='REFUND_PENDING', "failureReason"=${input.reason}, "updatedAt"=CURRENT_TIMESTAMP
      WHERE id=${authorization.id} AND status='CAPTURED'
    `;
    if (locked !== 1) throw new Error("Возврат уже запущен другим запросом");

    let result: Awaited<ReturnType<typeof refundHypTransaction>>;
    try {
      result = await refundHypTransaction({
        transactionId: authorization.providerReference,
        amountMinor: authorization.amountMinor,
      });
    } catch (error) {
      await db.$executeRaw`
        UPDATE "PaymentAuthorization"
        SET status='CAPTURED', "failureReason"=${error instanceof Error ? error.message : "HYP refund failed"}, "updatedAt"=CURRENT_TIMESTAMP
        WHERE id=${authorization.id} AND status='REFUND_PENDING'
      `;
      throw error;
    }

    await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({
        where: { id: order.id },
        include: { items: true, tickets: true },
      });
      if (!current) throw new Error("Заказ не найден во время завершения возврата");
      if (current.status !== "PAID") throw new Error("Статус заказа изменился во время возврата");

      await tx.$executeRaw`
        UPDATE "PaymentAuthorization"
        SET status='REFUNDED', "voidedAt"=CURRENT_TIMESTAMP,
            "failureReason"=${input.reason}, "updatedAt"=CURRENT_TIMESTAMP
        WHERE id=${authorization.id} AND status='REFUND_PENDING'
      `;

      await tx.ticket.updateMany({
        where: { orderId: current.id },
        data: { status: "CANCELLED", walletUpdatedAt: new Date() },
      });

      for (const item of current.items) {
        const category = await tx.ticketCategory.findUnique({
          where: { eventId_name: { eventId: current.eventId, name: item.categoryName } },
        });
        if (category) {
          await tx.ticketCategory.update({
            where: { id: category.id },
            data: { sold: Math.max(0, category.sold - item.quantity) },
          });
        }
        if (item.tableId) {
          await tx.table.update({ where: { id: item.tableId }, data: { reserved: false } });
        }
        if (item.seatId) {
          await tx.seat.update({ where: { id: item.seatId }, data: { status: "AVAILABLE" } });
        }
      }

      await tx.order.update({
        where: { id: current.id },
        data: {
          status: "CANCELLED",
          reviewNote: `Полный возврат HYP: ${input.reason}`,
        },
      });
    });

    await notifyWalletTickets(order.tickets.map((ticket) => ticket.id));
    await writeAudit(actor, {
      action: "ORDER_REFUNDED",
      entityType: "Order",
      entityId: order.id,
      summary: `Полный возврат по заказу ${order.publicId}: ${authorization.amountMinor / 100} ₪`,
      metadata: {
        amountMinor: authorization.amountMinor,
        reason: input.reason,
        cardLast4: authorization.cardLast4,
        hypRefundTransactionId: result.transactionId,
        originalTransactionId: result.originalTransactionId,
      },
    });

    return NextResponse.json({
      ok: true,
      full: true,
      amountMinor: authorization.amountMinor,
      hypTransactionId: result.transactionId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка возврата";
    console.error("hyp.refund.failed", { orderId: id, authorizationId, message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
