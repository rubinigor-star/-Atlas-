import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { refundHypDeal } from "@/lib/hyp-yaadpay";
import { sendOrderCancellationEmail } from "@/lib/order-cancellation-email";

export type OrderRefundInput = {
  amountMinor?: number;
  reason?: string;
  requestId?: string;
  idempotencyKey?: string;
};

type AuthorizationRow = {
  id: string;
  provider: string;
  hypTransId: string | null;
  hypCgUid: string | null;
  amountMinor: number;
  refundedMinor: number;
  status: string;
};

export class OrderRefundError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrderRefundError";
    this.status = status;
  }
}

export async function refundOrder(publicId: string, body: OrderRefundInput) {
  const order = await db.order.findUnique({
    where: { publicId },
    include: { items: true },
  });
  if (!order) throw new OrderRefundError("Заказ не найден", 404);
  if (order.status !== "PAID") {
    throw new OrderRefundError("Возврат доступен только для оплаченного заказа", 409);
  }

  const amountMinor = Number(body.amountMinor);
  const reason = body.reason?.trim() || "";
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new OrderRefundError("Некорректная сумма возврата", 400);
  }
  if (reason.length < 3) {
    throw new OrderRefundError("Укажите причину возврата", 400);
  }

  const authorization = (await db.$queryRawUnsafe<AuthorizationRow[]>(
    `SELECT "id","provider","hypTransId","hypCgUid","amountMinor","refundedMinor","status"
     FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`,
    order.id,
  ))[0];

  if (!authorization || authorization.provider !== "HYP") {
    throw new OrderRefundError("Исходная транзакция HYP не найдена", 409);
  }
  if (!authorization.hypTransId) {
    throw new OrderRefundError("Идентификатор исходной операции HYP не сохранён. Возврат не отправлен.", 409);
  }

  const refundableMinor = authorization.amountMinor - authorization.refundedMinor;
  if (amountMinor > refundableMinor) {
    throw new OrderRefundError(`Доступно к возврату ${(refundableMinor / 100).toFixed(2)} ₪`, 409);
  }

  const fullRefund = amountMinor === refundableMinor;
  const idempotencyKey = body.idempotencyKey?.trim()
    || `refund:${order.id}:${amountMinor}:${body.requestId || randomUUID()}`;
  const attemptId = `ref_${randomUUID().replace(/-/g, "")}`;

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "RefundAttempt"
        ("id","orderId","authorizationId","requestId","idempotencyKey","amountMinor","reason","status","sourceCgUid","sourceTranId","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      attemptId,
      order.id,
      authorization.id,
      body.requestId || null,
      idempotencyKey,
      amountMinor,
      reason,
      authorization.hypCgUid,
      authorization.hypTransId,
    );
  } catch {
    const existing = (await db.$queryRawUnsafe<Array<{
      status: string;
      amountMinor: number;
      refundTranId: string | null;
    }>>(
      `SELECT "status","amountMinor","refundTranId" FROM "RefundAttempt" WHERE "idempotencyKey"=$1 LIMIT 1`,
      idempotencyKey,
    ))[0];

    if (existing?.status === "SUCCEEDED") {
      return { ok: true, idempotent: true, ...existing };
    }
    throw new OrderRefundError("Этот возврат уже обрабатывается", 409);
  }

  try {
    const result = await refundHypDeal({
      transactionId: authorization.hypTransId,
      amountMinor,
    });

    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "RefundAttempt"
         SET "status"='SUCCEEDED',"refundTranId"=$2,"hypResultCode"=$3,"hypStatusText"=$4,
             "rawResponse"=$5,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$1`,
        attemptId,
        result.refundTranId || null,
        result.resultCode,
        result.statusText,
        result.rawResponse,
      );

      const newRefunded = authorization.refundedMinor + amountMinor;
      await tx.$executeRawUnsafe(
        `UPDATE "PaymentAuthorization"
         SET "refundedMinor"=$2,"status"=$3,
             "voidedAt"=CASE WHEN $3='REFUNDED' THEN CURRENT_TIMESTAMP ELSE "voidedAt" END,
             "updatedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$1`,
        authorization.id,
        newRefunded,
        newRefunded === authorization.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED",
      );

      if (body.requestId) {
        await tx.$executeRawUnsafe(
          `UPDATE "RefundRequest" SET "status"='APPROVED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
          body.requestId,
        );
      }

      if (newRefunded === authorization.amountMinor) {
        await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
        await tx.ticket.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });

        for (const item of order.items) {
          await tx.ticketCategory.updateMany({
            where: { eventId: order.eventId, name: item.categoryName },
            data: { sold: { decrement: item.quantity } },
          });
          if (item.tableId) {
            await tx.table.updateMany({ where: { id: item.tableId }, data: { reserved: false } });
          }
          if (item.seatId) {
            await tx.seat.updateMany({ where: { id: item.seatId }, data: { status: "AVAILABLE" } });
          }
        }
      }
    });

    let emailSent = false;
    let emailError: string | null = null;
    if (fullRefund) {
      try {
        await sendOrderCancellationEmail(order.publicId, amountMinor);
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Не удалось отправить email об отмене";
        console.error("[refund-cancellation-email]", { publicId: order.publicId, message: emailError });
      }
    }

    return {
      ok: true,
      amountMinor,
      fullRefund,
      refundTranId: result.refundTranId,
      resultCode: result.resultCode,
      emailSent,
      emailError,
    };
  } catch (error) {
    if (error instanceof OrderRefundError) throw error;
    const message = error instanceof Error ? error.message : "Возврат отклонён HYP";
    await db.$executeRawUnsafe(
      `UPDATE "RefundAttempt"
       SET "status"='FAILED',"failureReason"=$2,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1`,
      attemptId,
      message,
    );
    throw new OrderRefundError(message, 502);
  }
}
