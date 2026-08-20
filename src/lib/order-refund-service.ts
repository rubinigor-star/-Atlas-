import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { refundHypDeal } from "@/lib/hyp-yaadpay";
import { sendOrderCancellationEmail } from "@/lib/order-cancellation-email";
import { ensureCancellationRuntime, evaluateCancellationEligibility, statutoryCancellationFeeMinor } from "@/lib/cancellations";

export type RefundMode = "TECHNICAL_PARTIAL" | "CANCELLATION";
export type CancellationFeePayer = "CUSTOMER" | "ORGANIZER";

export type OrderRefundInput = {
  mode?: RefundMode;
  amountMinor?: number;
  reason?: string;
  requestId?: string;
  idempotencyKey?: string;
  cancellationFeePayer?: CancellationFeePayer;
  cancellationPublicId?: string;
};

export type OrderRefundContext = { actorId?: string | null };

type AuthorizationRow = {
  id: string;
  provider: string;
  hypTransId: string | null;
  hypCgUid: string | null;
  amountMinor: number;
  refundedMinor: number;
  status: string;
};

type CancellationRow = { id: string; publicId: string; status: string };

export class OrderRefundError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "OrderRefundError";
    this.status = status;
  }
}

function newCancellationPublicId() {
  return `CAN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export async function getRefundPolicy(publicId: string) {
  const order = await db.order.findUnique({ where: { publicId }, select: { id: true, status: true, totalMinor: true } });
  if (!order) throw new OrderRefundError("Заказ не найден", 404);
  const authorization = (await db.$queryRawUnsafe<Array<Pick<AuthorizationRow, "provider" | "amountMinor" | "refundedMinor" | "status">>>(
    `SELECT "provider","amountMinor","refundedMinor","status" FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`, order.id,
  ))[0];
  const refundedMinor = authorization?.refundedMinor ?? 0;
  const refundableMinor = authorization?.provider === "HYP" ? Math.max(0, authorization.amountMinor - refundedMinor) : 0;
  const cancellationFeeMinor = statutoryCancellationFeeMinor(order.totalMinor);
  return {
    orderStatus: order.status,
    orderTotalMinor: order.totalMinor,
    provider: authorization?.provider ?? null,
    paymentStatus: authorization?.status ?? null,
    refundedMinor,
    refundableMinor,
    cancellationFeeMinor,
    customerPaysRefundMinor: Math.max(0, refundableMinor - cancellationFeeMinor),
    organizerPaysRefundMinor: refundableMinor,
    canRefund: order.status === "PAID" && authorization?.provider === "HYP" && refundableMinor > 0,
    modes: ["TECHNICAL_PARTIAL", "CANCELLATION"] as RefundMode[],
    cancellationFeePayers: ["CUSTOMER", "ORGANIZER"] as CancellationFeePayer[],
  };
}

async function prepareCancellation(input: {
  order: Awaited<ReturnType<typeof db.order.findUnique>> & { items: unknown[] };
  reason: string;
  refundAmountMinor: number;
  feeMinor: number;
  organizerChargeMinor: number;
  publicId?: string;
  actorId?: string | null;
}) {
  if (!input.order) throw new OrderRefundError("Заказ не найден", 404);
  await ensureCancellationRuntime();
  let existing: CancellationRow | undefined;
  if (input.publicId) {
    existing = (await db.$queryRawUnsafe<CancellationRow[]>(
      `SELECT "id","publicId","status" FROM "CancellationRequest" WHERE "publicId"=$1 AND "orderId"=$2 LIMIT 1`, input.publicId, input.order.id,
    ))[0];
  }
  if (!existing) {
    existing = (await db.$queryRawUnsafe<CancellationRow[]>(
      `SELECT "id","publicId","status" FROM "CancellationRequest" WHERE "orderId"=$1 AND "status" IN ('NEW','REFUND_PENDING') ORDER BY "createdAt" DESC LIMIT 1`, input.order.id,
    ))[0];
  }
  const event = await db.event.findUnique({ where: { id: input.order.eventId }, select: { startsAt: true, organizationId: true } });
  if (!event) throw new OrderRefundError("Мероприятие не найдено", 404);
  const eligibility = evaluateCancellationEligibility(input.order.createdAt, event.startsAt, null);
  if (existing) {
    await db.$executeRawUnsafe(
      `UPDATE "CancellationRequest" SET "status"='REFUND_PENDING',"refundAmountMinor"=$2,"organizerChargeMinor"=$3,"decisionNote"=$4,"reviewedBy"=COALESCE($5,"reviewedBy"),"reviewedAt"=COALESCE("reviewedAt",CURRENT_TIMESTAMP),"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
      existing.id, input.refundAmountMinor, input.organizerChargeMinor, input.reason, input.actorId || null,
    );
    return existing;
  }
  const id = randomUUID();
  const publicId = input.publicId?.trim() || newCancellationPublicId();
  await db.$executeRawUnsafe(
    `INSERT INTO "CancellationRequest" ("id","publicId","orderId","organizationId","eventId","customerEmail","reason","status","legalStatus","legalReason","orderAmountMinor","statutoryFeeMinor","refundAmountMinor","organizerChargeMinor","decisionNote","reviewedBy","reviewedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,'REFUND_PENDING',$8,$9,$10,$11,$12,$13,$7,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
    id, publicId, input.order.id, event.organizationId, input.order.eventId, input.order.customerEmail, input.reason,
    eligibility.status, eligibility.reason, input.order.totalMinor, input.feeMinor, input.refundAmountMinor, input.organizerChargeMinor, input.actorId || null,
  );
  return { id, publicId, status: "REFUND_PENDING" } satisfies CancellationRow;
}

export async function refundOrder(publicId: string, body: OrderRefundInput, context: OrderRefundContext = {}) {
  const order = await db.order.findUnique({ where: { publicId }, include: { items: true } });
  if (!order) throw new OrderRefundError("Заказ не найден", 404);
  if (order.status !== "PAID") throw new OrderRefundError("Возврат доступен только для оплаченного заказа", 409);

  const reason = body.reason?.trim() || "";
  if (reason.length < 3) throw new OrderRefundError("Укажите причину возврата", 400);
  if (body.mode !== "TECHNICAL_PARTIAL" && body.mode !== "CANCELLATION") {
    throw new OrderRefundError("REFUND_MODE_REQUIRED", 400);
  }

  const authorization = (await db.$queryRawUnsafe<AuthorizationRow[]>(
    `SELECT "id","provider","hypTransId","hypCgUid","amountMinor","refundedMinor","status" FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`,
    order.id,
  ))[0];
  if (!authorization || authorization.provider !== "HYP") throw new OrderRefundError("Исходная транзакция HYP не найдена", 409);
  if (!authorization.hypTransId) throw new OrderRefundError("Идентификатор исходной операции HYP не сохранён. Возврат не отправлен.", 409);

  const refundableMinor = authorization.amountMinor - authorization.refundedMinor;
  if (refundableMinor <= 0) throw new OrderRefundError("По заказу больше нечего возвращать", 409);

  const cancellation = body.mode === "CANCELLATION";
  const feeMinor = cancellation ? statutoryCancellationFeeMinor(order.totalMinor) : 0;
  let amountMinor: number;
  let organizerChargeMinor = 0;
  let cancellationRow: CancellationRow | undefined;

  if (cancellation) {
    if (body.cancellationFeePayer !== "CUSTOMER" && body.cancellationFeePayer !== "ORGANIZER") {
      throw new OrderRefundError("CANCELLATION_FEE_PAYER_REQUIRED", 400);
    }
    amountMinor = body.cancellationFeePayer === "CUSTOMER" ? Math.max(0, refundableMinor - feeMinor) : refundableMinor;
    organizerChargeMinor = body.cancellationFeePayer === "ORGANIZER" ? feeMinor : 0;
    if (amountMinor <= 0) throw new OrderRefundError("Сумма возврата после комиссии равна нулю", 409);
    cancellationRow = await prepareCancellation({
      order,
      reason,
      refundAmountMinor: amountMinor,
      feeMinor,
      organizerChargeMinor,
      publicId: body.cancellationPublicId,
      actorId: context.actorId,
    });
  } else {
    amountMinor = Number(body.amountMinor);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw new OrderRefundError("Некорректная сумма возврата", 400);
    if (amountMinor >= refundableMinor) throw new OrderRefundError("Полный возврат возможен только как отмена с выбором плательщика 5%", 400);
  }

  if (amountMinor > refundableMinor) throw new OrderRefundError(`Доступно к возврату ${(refundableMinor / 100).toFixed(2)} ₪`, 409);

  const idempotencyKey = body.idempotencyKey?.trim() || `${cancellation ? "cancellation" : "refund"}:${order.id}:${amountMinor}:${body.requestId || cancellationRow?.id || randomUUID()}`;
  const attemptId = `ref_${randomUUID().replace(/-/g, "")}`;

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "RefundAttempt" ("id","orderId","authorizationId","requestId","idempotencyKey","amountMinor","reason","status","sourceCgUid","sourceTranId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      attemptId, order.id, authorization.id, body.requestId || null, idempotencyKey, amountMinor, reason, authorization.hypCgUid, authorization.hypTransId,
    );
  } catch {
    const existing = (await db.$queryRawUnsafe<Array<{ status: string; amountMinor: number; refundTranId: string | null }>>(
      `SELECT "status","amountMinor","refundTranId" FROM "RefundAttempt" WHERE "idempotencyKey"=$1 LIMIT 1`, idempotencyKey,
    ))[0];
    if (existing?.status === "SUCCEEDED") return { ok: true, idempotent: true, ...existing };
    throw new OrderRefundError("Этот возврат уже обрабатывается", 409);
  }

  try {
    const result = await refundHypDeal({ transactionId: authorization.hypTransId, amountMinor });
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        `UPDATE "RefundAttempt" SET "status"='SUCCEEDED',"refundTranId"=$2,"hypResultCode"=$3,"hypStatusText"=$4,"rawResponse"=$5,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
        attemptId, result.refundTranId || null, result.resultCode, result.statusText, result.rawResponse,
      );
      const newRefunded = authorization.refundedMinor + amountMinor;
      await tx.$executeRawUnsafe(
        `UPDATE "PaymentAuthorization" SET "refundedMinor"=$2,"status"=$3,"voidedAt"=CASE WHEN $3='REFUNDED' THEN CURRENT_TIMESTAMP ELSE "voidedAt" END,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
        authorization.id, newRefunded, newRefunded === authorization.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED",
      );
      if (body.requestId) {
        await tx.$executeRawUnsafe(`UPDATE "RefundRequest" SET "status"='APPROVED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, body.requestId);
      }
      if (cancellation) {
        await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
        await tx.ticket.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
        for (const item of order.items) {
          await tx.ticketCategory.updateMany({ where: { eventId: order.eventId, name: item.categoryName }, data: { sold: { decrement: item.quantity } } });
          if (item.tableId) await tx.table.updateMany({ where: { id: item.tableId }, data: { reserved: false } });
          if (item.seatId) await tx.seat.updateMany({ where: { id: item.seatId }, data: { status: "AVAILABLE" } });
        }
        if (cancellationRow) {
          await tx.$executeRawUnsafe(`UPDATE "CancellationRequest" SET "status"='REFUNDED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, cancellationRow.id);
        }
      }
    });

    let emailSent = false;
    let emailError: string | null = null;
    if (cancellation) {
      try {
        await sendOrderCancellationEmail(order.publicId, amountMinor, cancellationRow?.publicId || body.cancellationPublicId);
        emailSent = true;
      } catch (error) {
        emailError = error instanceof Error ? error.message : "Не удалось отправить email об отмене";
        console.error("[refund-cancellation-email]", { publicId: order.publicId, message: emailError });
      }
    }

    return {
      ok: true,
      mode: body.mode,
      amountMinor,
      orderCancelled: cancellation,
      cancellationPublicId: cancellationRow?.publicId ?? null,
      cancellationFeeMinor: feeMinor,
      cancellationFeePayer: cancellation ? body.cancellationFeePayer : null,
      organizerChargeMinor,
      refundTranId: result.refundTranId,
      resultCode: result.resultCode,
      emailSent,
      emailError,
    };
  } catch (error) {
    if (error instanceof OrderRefundError) throw error;
    const message = error instanceof Error ? error.message : "Возврат отклонён HYP";
    await db.$executeRawUnsafe(`UPDATE "RefundAttempt" SET "status"='FAILED',"failureReason"=$2,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, attemptId, message);
    if (cancellationRow) {
      await db.$executeRawUnsafe(`UPDATE "CancellationRequest" SET "status"='REFUND_FAILED',"decisionNote"=COALESCE("decisionNote",'') || $2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, cancellationRow.id, `\nHYP: ${message}`);
    }
    throw new OrderRefundError(message, 502);
  }
}
