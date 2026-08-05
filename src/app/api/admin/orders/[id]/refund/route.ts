import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { refundHypDeal } from "@/lib/hyp-refunds";

type AuthorizationRow = {
  id: string;
  provider: string;
  providerReference: string;
  cgUid: string | null;
  tranId: string | null;
  amountMinor: number;
  refundedMinor: number;
  status: string;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const order = await db.order.findUnique({ where: { publicId: id }, include: { items: true } });
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    await requireEventAccess("ORDER_MANAGE", order.eventId);
    if (order.status !== "PAID") return NextResponse.json({ error: "Возврат доступен только для оплаченного заказа" }, { status: 409 });

    const body = await request.json().catch(() => null) as { amountMinor?: number; reason?: string; requestId?: string; idempotencyKey?: string } | null;
    const amountMinor = Number(body?.amountMinor);
    const reason = body?.reason?.trim() || "";
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) return NextResponse.json({ error: "Некорректная сумма возврата" }, { status: 400 });
    if (reason.length < 3) return NextResponse.json({ error: "Укажите причину возврата" }, { status: 400 });

    const authorization = (await db.$queryRawUnsafe<AuthorizationRow[]>(
      `SELECT "id","provider","providerReference","cgUid","tranId","amountMinor","refundedMinor","status" FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`,
      order.id,
    ))[0];
    if (!authorization || authorization.provider !== "HYP") return NextResponse.json({ error: "Исходная транзакция HYP не найдена" }, { status: 409 });
    if (!authorization.cgUid && !authorization.tranId) {
      return NextResponse.json({ error: "В старой оплате не сохранены cgUid/tranId. Для безопасного теста нужна новая оплата." }, { status: 409 });
    }

    const refundableMinor = authorization.amountMinor - authorization.refundedMinor;
    if (amountMinor > refundableMinor) return NextResponse.json({ error: `Доступно к возврату ${(refundableMinor / 100).toFixed(2)} ₪` }, { status: 409 });
    const fullRefund = amountMinor === refundableMinor;
    const idempotencyKey = body?.idempotencyKey?.trim() || `refund:${order.id}:${amountMinor}:${body?.requestId || randomUUID()}`;
    const attemptId = `ref_${randomUUID().replace(/-/g, "")}`;

    try {
      await db.$executeRawUnsafe(
        `INSERT INTO "RefundAttempt" ("id","orderId","authorizationId","requestId","idempotencyKey","amountMinor","reason","status","sourceCgUid","sourceTranId","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
        attemptId, order.id, authorization.id, body?.requestId || null, idempotencyKey, amountMinor, reason, authorization.cgUid, authorization.tranId,
      );
    } catch {
      const existing = (await db.$queryRawUnsafe<Array<{ status: string; amountMinor: number; refundTranId: string | null }>>(
        `SELECT "status","amountMinor","refundTranId" FROM "RefundAttempt" WHERE "idempotencyKey"=$1 LIMIT 1`, idempotencyKey,
      ))[0];
      if (existing?.status === "SUCCEEDED") return NextResponse.json({ ok: true, idempotent: true, ...existing });
      return NextResponse.json({ error: "Этот возврат уже обрабатывается" }, { status: 409 });
    }

    try {
      const result = await refundHypDeal({
        cgUid: authorization.cgUid,
        tranId: authorization.tranId,
        amountMinor: fullRefund ? undefined : amountMinor,
      });

      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          `UPDATE "RefundAttempt" SET "status"='SUCCEEDED',"refundTranId"=$2,"hypResultCode"=$3,"hypStatus"=$4,"hypStatusText"=$5,"hypOrgUid"=$6,"rawResponse"=$7,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
          attemptId, result.refundTranId || null, result.resultCode, result.status || null, result.statusText || null, result.orgUid || null, result.rawResponse,
        );
        const newRefunded = authorization.refundedMinor + amountMinor;
        await tx.$executeRawUnsafe(
          `UPDATE "PaymentAuthorization" SET "refundedMinor"=$2,"status"=$3,"voidedAt"=CASE WHEN $3='REFUNDED' THEN CURRENT_TIMESTAMP ELSE "voidedAt" END,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
          authorization.id, newRefunded, newRefunded === authorization.amountMinor ? "REFUNDED" : "PARTIALLY_REFUNDED",
        );
        if (body?.requestId) await tx.$executeRawUnsafe(`UPDATE "RefundRequest" SET "status"='APPROVED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, body.requestId);

        if (newRefunded === authorization.amountMinor) {
          await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
          await tx.ticket.updateMany({ where: { orderId: order.id }, data: { status: "CANCELLED" } });
          for (const item of order.items) {
            await tx.ticketCategory.updateMany({
              where: { eventId: order.eventId, name: item.categoryName },
              data: { sold: { decrement: item.quantity } },
            });
            if (item.tableId) await tx.table.updateMany({ where: { id: item.tableId }, data: { reserved: false } });
            if (item.seatId) await tx.seat.updateMany({ where: { id: item.seatId }, data: { status: "AVAILABLE" } });
          }
        }
      });

      return NextResponse.json({ ok: true, amountMinor, fullRefund, refundTranId: result.refundTranId, resultCode: result.resultCode });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Возврат отклонён HYP";
      await db.$executeRawUnsafe(
        `UPDATE "RefundAttempt" SET "status"='FAILED',"failureReason"=$2,"completedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
        attemptId, message,
      );
      return NextResponse.json({ error: message }, { status: 502 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка возврата";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
