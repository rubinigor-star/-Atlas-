import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { sendOrderRejectionEmail, sendOrderTicketEmail } from "@/lib/order-email";
import { captureTestAuthorization, voidTestAuthorization } from "@/lib/payment-authorization";
import { captureHypAuthorization, cancelHypAuthorization } from "@/lib/hyp-yaadpay";
import { commitReservation, releaseReservation } from "@/lib/reservation";
import { cancelOrderTickets, issueTicketsForOrder } from "@/lib/ticket-engine";
import { parseEventRejectionMessage } from "@/lib/event-approval-message";

const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";
const reviewSchema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional() });

type LegacyRuntimeRow = { exists: number | bigint };
type AuthorizationRow = {
  id: string;
  provider: string;
  status: string;
  amountMinor: number;
  currency: string;
  hypTransId: string | null;
  hypCgUid: string | null;
  hypCardToken: string | null;
  hypCardExp: string | null;
};

let hypColumnsReady: Promise<void> | undefined;
function ensureHypApprovalColumns() {
  hypColumnsReady ??= (async () => {
    const statements = [
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTransId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCgUid" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCardToken" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCardExp" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypAuthorizationTransId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCaptureTransId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCancelTransId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCapturePayloadJson" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCancelPayloadJson" TEXT`,
    ];
    for (const statement of statements) await db.$executeRawUnsafe(statement);
  })().catch((error) => { hypColumnsReady = undefined; throw error; });
  return hypColumnsReady;
}

async function runtimeRecordExists(table: "PaymentAuthorization" | "Reservation", orderId: string, tx: typeof db) {
  const rows = table === "PaymentAuthorization"
    ? await tx.$queryRaw<LegacyRuntimeRow[]>`SELECT COUNT(*) AS exists FROM PaymentAuthorization WHERE orderId = ${orderId}`
    : await tx.$queryRaw<LegacyRuntimeRow[]>`SELECT COUNT(*) AS exists FROM Reservation WHERE orderId = ${orderId}`;
  return Number(rows[0]?.exists ?? 0) > 0;
}

async function getAuthorization(orderId: string): Promise<AuthorizationRow | null> {
  await ensureHypApprovalColumns();
  const rows = await db.$queryRawUnsafe<AuthorizationRow[]>(
    `SELECT "id","provider","status","amountMinor","currency","hypTransId","hypCgUid","hypCardToken","hypCardExp"
     FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`,
    orderId,
  );
  return rows[0] ?? null;
}

async function assertApprovalPreflight(publicId: string) {
  const current = await db.order.findUnique({ where: { publicId }, include: { items: true } });
  if (!current) throw new Error("Заявка не найдена");
  if (current.status !== "PENDING_APPROVAL") throw new Error("Эта заявка уже рассмотрена");

  const authorization = await getAuthorization(current.id);
  const hasReservation = await runtimeRecordExists("Reservation", current.id, db);
  const legacyDemoOrder = !authorization && !hasReservation;

  if (!legacyDemoOrder && !authorization) throw new Error("Предварительная авторизация оплаты не найдена");
  if (!legacyDemoOrder && authorization?.amountMinor !== current.totalMinor) throw new Error("Сумма авторизации не совпадает с суммой заказа");

  if (!legacyDemoOrder) {
    const active = await db.$queryRaw<Array<{ exists: number | bigint }>>`
      SELECT COUNT(*) AS exists FROM Reservation WHERE orderId = ${current.id} AND status = 'ACTIVE' AND expiresAt > CURRENT_TIMESTAMP
    `;
    if (Number(active[0]?.exists ?? 0) !== 1) throw new Error("Срок резерва заявки истёк. Нельзя списывать оплату или выпускать билет");
  }

  return { current, authorization, hasReservation, legacyDemoOrder };
}

async function captureProviderAuthorization(authorization: AuthorizationRow | null) {
  if (!authorization) return;
  if (authorization.provider === "ATLAS_TEST") return;
  if (authorization.provider !== "HYP") throw new Error(`Неподдерживаемый провайдер авторизации: ${authorization.provider}`);
  if (authorization.status === "CAPTURED") return;
  if (authorization.status !== "AUTHORIZED") throw new Error(`HYP-авторизация недоступна для списания: ${authorization.status}`);

  const claimed = await db.$executeRawUnsafe(
    `UPDATE "PaymentAuthorization" SET "status"='CAPTURING',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='AUTHORIZED'`,
    authorization.id,
  );
  if (claimed !== 1) throw new Error("Эта заявка уже обрабатывается");

  try {
    const result = await captureHypAuthorization({
      cardToken: authorization.hypCardToken || "",
      cardExp: authorization.hypCardExp || "",
      cgUid: authorization.hypCgUid || "",
      amountMinor: authorization.amountMinor,
    });
    await db.$executeRawUnsafe(
      `UPDATE "PaymentAuthorization" SET
        "status"='CAPTURED',
        "hypAuthorizationTransId"=COALESCE("hypAuthorizationTransId","hypTransId"),
        "hypCaptureTransId"=NULLIF($2,''),
        "hypTransId"=COALESCE(NULLIF($2,''),"hypTransId"),
        "providerReference"=COALESCE(NULLIF($2,''),"providerReference"),
        "hypCapturePayloadJson"=$3,
        "capturedAt"=CURRENT_TIMESTAMP,
        "updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 AND "status"='CAPTURING'`,
      authorization.id,
      result.captureTranId,
      result.rawResponse,
    );
  } catch (error) {
    await db.$executeRawUnsafe(
      `UPDATE "PaymentAuthorization" SET "status"='AUTHORIZED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='CAPTURING'`,
      authorization.id,
    ).catch(() => undefined);
    throw error;
  }
}

async function cancelProviderAuthorization(authorization: AuthorizationRow | null) {
  if (!authorization) return;
  if (authorization.provider === "ATLAS_TEST") return;
  if (authorization.provider !== "HYP") throw new Error(`Неподдерживаемый провайдер авторизации: ${authorization.provider}`);
  if (authorization.status === "VOIDED") return;
  if (authorization.status === "CAPTURED") throw new Error("Оплата уже списана. Используйте возврат, а не отклонение заявки");
  if (authorization.status !== "AUTHORIZED") throw new Error(`HYP-авторизация недоступна для отмены: ${authorization.status}`);

  const claimed = await db.$executeRawUnsafe(
    `UPDATE "PaymentAuthorization" SET "status"='CANCELLING',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='AUTHORIZED'`,
    authorization.id,
  );
  if (claimed !== 1) throw new Error("Эта заявка уже обрабатывается");

  try {
    const result = await cancelHypAuthorization({ cgUid: authorization.hypCgUid || "" });
    await db.$executeRawUnsafe(
      `UPDATE "PaymentAuthorization" SET
        "status"='VOIDED',
        "hypAuthorizationTransId"=COALESCE("hypAuthorizationTransId","hypTransId"),
        "hypCancelTransId"=NULLIF($2,''),
        "hypCancelPayloadJson"=$3,
        "voidedAt"=CURRENT_TIMESTAMP,
        "updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 AND "status"='CANCELLING'`,
      authorization.id,
      result.cancelTranId,
      result.rawResponse,
    );
  } catch (error) {
    await db.$executeRawUnsafe(
      `UPDATE "PaymentAuthorization" SET "status"='AUTHORIZED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='CANCELLING'`,
      authorization.id,
    ).catch(() => undefined);
    throw error;
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  try {
    const target = await db.order.findUnique({
      where: { publicId },
      select: { id: true, eventId: true, customerName: true, status: true, _count: { select: { tickets: true } } },
    });
    if (!target) throw new Error("Заявка не найдена");
    const actor = await requireEventAccess("REQUEST_REVIEW", target.eventId);
    const removable = target.status === "CANCELLED" || target.status === "REJECTED";
    if (!removable) throw new Error("Удалить из очереди можно только отменённую или отклонённую заявку");
    if (target._count.tickets > 0) throw new Error("Заявку с выпущенными билетами нельзя удалить из очереди");

    await db.order.update({
      where: { id: target.id },
      data: { reviewNote: DISMISSED_EXPIRED_NOTE, reviewedAt: new Date(), paymentDueAt: null },
    });

    await writeAudit(actor, {
      action: "REQUEST_DISMISSED",
      entityType: "Order",
      entityId: target.id,
      summary: `Заявка ${target.customerName} удалена из рабочей очереди`,
      metadata: { publicId },
    });
    return NextResponse.json({ status: target.status, dismissed: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось удалить заявку из очереди" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  try {
    const input = reviewSchema.parse(await req.json());
    const target = await db.order.findUnique({ where: { publicId }, select: { id: true, eventId: true, customerName: true } });
    if (!target) throw new Error("Заявка не найдена");
    const actor = await requireEventAccess("REQUEST_REVIEW", target.eventId);

    const preflight = await assertApprovalPreflight(publicId);
    const { authorization } = preflight;

    if (input.action === "approve") await captureProviderAuthorization(authorization);
    else await cancelProviderAuthorization(authorization);

    let legacyDemoOrder = preflight.legacyDemoOrder;
    const order = await db.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { publicId }, include: { event: { select: { description: true } }, items: { include: { table: true, seat: true } }, tickets: true } });
      if (!current) throw new Error("Заявка не найдена");
      if (current.status !== "PENDING_APPROVAL") throw new Error("Эта заявка уже рассмотрена");

      const [hasAuthorization, hasReservation] = await Promise.all([
        runtimeRecordExists("PaymentAuthorization", current.id, tx as typeof db),
        runtimeRecordExists("Reservation", current.id, tx as typeof db),
      ]);
      legacyDemoOrder = !hasAuthorization && !hasReservation;

      const authRows = hasAuthorization
        ? await tx.$queryRaw<Array<{ provider: string; status: string }>>`SELECT provider, status FROM PaymentAuthorization WHERE orderId = ${current.id} LIMIT 1`
        : [];
      const auth = authRows[0];

      if (input.action === "reject") {
        if (hasReservation) await releaseReservation(current.id, tx);
        if (auth?.provider === "ATLAS_TEST") await voidTestAuthorization(current.id, tx);
        if (auth?.provider === "HYP" && auth.status !== "VOIDED") throw new Error("HYP не подтвердил отмену предварительной авторизации");
        await cancelOrderTickets(current.id, tx);
        const rejectionMessage = parseEventRejectionMessage(current.event.description);
        return tx.order.update({ where: { id: current.id }, data: { status: "REJECTED", reviewNote: input.note?.trim() || rejectionMessage, reviewedAt: new Date(), paymentDueAt: null } });
      }

      if (auth?.provider === "ATLAS_TEST") await captureTestAuthorization(current.id, tx);
      if (auth?.provider === "HYP" && auth.status !== "CAPTURED") throw new Error("HYP не подтвердил списание оплаты");
      if (hasReservation) await commitReservation(current.id, tx);

      for (const item of current.items) {
        const category = await tx.ticketCategory.findUnique({ where: { eventId_name: { eventId: current.eventId, name: item.categoryName } } });
        if (!category || category.sold + item.quantity > category.capacity) throw new Error(`Недостаточно мест в категории ${item.categoryName}`);
        if (item.seatId) {
          const claimed = await tx.seat.updateMany({ where: { id: item.seatId, status: "AVAILABLE" }, data: { status: "RESERVED" } });
          if (claimed.count !== 1) throw new Error("Выбранное место уже занято");
        } else if (item.tableId) {
          const claimed = await tx.table.updateMany({ where: { id: item.tableId, reserved: false }, data: { reserved: true } });
          if (claimed.count !== 1) throw new Error("Выбранный стол уже занят");
        }
        await tx.ticketCategory.update({ where: { id: category.id }, data: { sold: { increment: item.quantity } } });
      }

      const paid = await tx.order.update({ where: { id: current.id }, data: { status: "PAID", reviewNote: input.note || (legacyDemoOrder ? "Одобрено как демо-заказ без авторизации оплаты" : null), reviewedAt: new Date(), paymentDueAt: null } });
      await issueTicketsForOrder(current.id, tx);
      return paid;
    });

    await writeAudit(actor, {
      action: input.action === "approve" ? (legacyDemoOrder ? "LEGACY_REQUEST_APPROVED" : "REQUEST_APPROVED_AND_CAPTURED") : "REQUEST_REJECTED_AND_VOIDED",
      entityType: "Order",
      entityId: target.id,
      summary: `${input.action === "approve" ? "Одобрена" : "Отклонена"} заявка ${target.customerName}${legacyDemoOrder ? " (демо-заказ без оплаты)" : ""}`,
      metadata: { publicId, legacyDemoOrder, paymentProvider: authorization?.provider || null },
    });

    let emailSent = false;
    let emailError: string | undefined;
    try {
      if (order.status === "PAID") { await sendOrderTicketEmail(publicId); emailSent = true; }
      else if (order.status === "REJECTED") { await sendOrderRejectionEmail(publicId); emailSent = true; }
    } catch (error) {
      emailError = error instanceof Error ? error.message : "Ошибка отправки уведомления";
    }

    return NextResponse.json({ status: order.status, emailSent, emailError, legacyDemoOrder });
  } catch (error) {
    const current = await db.order.findUnique({ where: { publicId }, select: { status: true } }).catch(() => null);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка проверки заявки", status: current?.status },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
