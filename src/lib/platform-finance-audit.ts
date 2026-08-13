import { db } from "@/lib/db";
import { ensureFinanceRuntime } from "@/lib/finance";

export type PlatformFinanceAuditOperation = {
  id: string;
  kind:
    | "BUYER_PAYMENT"
    | "ORGANIZER_SALE"
    | "ATLAS_SALES_FEE"
    | "REFUND"
    | "ATLAS_CANCELLATION_FEE"
    | "SERVICE_SMS"
    | "PAYOUT";
  organizationId: string;
  organizationName: string;
  eventId: string | null;
  eventTitle: string | null;
  orderId: string | null;
  publicId: string | null;
  amountMinor: number;
  createdAt: Date;
  description: string;
};

type AuditOrder = {
  orderId: string;
  publicId: string;
  eventId: string;
  eventTitle: string;
  organizationId: string;
  organizationName: string;
  createdAt: Date;
  buyerTotalMinor: number;
  organizerNetMinor: number;
  serviceFeeMinor: number;
};

type AuditCancellation = {
  id: string;
  orderId: string;
  publicId: string;
  refundAmountMinor: number | null;
  statutoryFeeMinor: number;
  createdAt: Date;
};

type AuditRefundAttempt = {
  orderId: string;
  totalRefundedMinor: number;
  createdAt: Date;
};

type AuditSms = {
  id: string;
  organizationId: string;
  organizationName: string;
  eventId: string | null;
  eventTitle: string | null;
  orderId: string | null;
  publicId: string | null;
  amountMinor: number;
  createdAt: Date;
  type: string;
};

type AuditPayout = {
  id: string;
  organizationId: string;
  organizationName: string;
  eventId: string;
  eventTitle: string;
  amountMinor: number;
  createdAt: Date;
  reference: string | null;
};

export async function platformFinanceAuditOperations(): Promise<PlatformFinanceAuditOperation[]> {
  await ensureFinanceRuntime();

  const [orders, cancellations, attempts, sms, payouts] = await Promise.all([
    db.$queryRawUnsafe<AuditOrder[]>(`
      SELECT o."id" AS "orderId",o."publicId",o."eventId",e."title" AS "eventTitle",
        e."organizationId",org."name" AS "organizationName",o."createdAt",
        COALESCE(s."buyerTotalMinor",o."totalMinor")::int AS "buyerTotalMinor",
        COALESCE(s."organizerNetMinor",o."totalMinor")::int AS "organizerNetMinor",
        COALESCE(s."serviceFeeMinor",0)::int AS "serviceFeeMinor"
      FROM "Order" o
      JOIN "Event" e ON e."id"=o."eventId"
      JOIN "Organization" org ON org."id"=e."organizationId"
      LEFT JOIN "OrderCommercialSnapshot" s ON s."orderId"=o."id"
      WHERE o."status" IN ('PAID','CANCELLED')
      ORDER BY o."createdAt" DESC`),
    db.$queryRawUnsafe<AuditCancellation[]>(`
      SELECT c."id",c."orderId",c."publicId",c."refundAmountMinor",c."statutoryFeeMinor",c."updatedAt" AS "createdAt"
      FROM "CancellationRequest" c
      WHERE c."status"='REFUNDED'`),
    db.$queryRawUnsafe<AuditRefundAttempt[]>(`
      SELECT r."orderId",SUM(r."amountMinor")::int AS "totalRefundedMinor",
        MAX(COALESCE(r."completedAt",r."updatedAt",r."createdAt")) AS "createdAt"
      FROM "RefundAttempt" r
      WHERE r."status"='SUCCEEDED'
      GROUP BY r."orderId"`).catch(() => [] as AuditRefundAttempt[]),
    db.$queryRawUnsafe<AuditSms[]>(`
      SELECT n."id",n."organizationId",org."name" AS "organizationName",o."eventId",e."title" AS "eventTitle",
        n."orderId",o."publicId",n."priceMinor"::int AS "amountMinor",
        COALESCE(n."sentAt",n."createdAt") AS "createdAt",n."type"
      FROM "NotificationDelivery" n
      JOIN "Organization" org ON org."id"=n."organizationId"
      LEFT JOIN "Order" o ON o."id"=n."orderId"
      LEFT JOIN "Event" e ON e."id"=o."eventId"
      WHERE n."channel"='SMS' AND n."status"='SENT' AND n."priceMinor">0
      ORDER BY COALESCE(n."sentAt",n."createdAt") DESC`),
    db.$queryRawUnsafe<AuditPayout[]>(`
      SELECT p."id",p."organizationId",org."name" AS "organizationName",p."eventId",e."title" AS "eventTitle",
        p."amountMinor"::int AS "amountMinor",COALESCE(p."paidAt",p."createdAt") AS "createdAt",p."reference"
      FROM "OrganizerPayout" p
      JOIN "Organization" org ON org."id"=p."organizationId"
      JOIN "Event" e ON e."id"=p."eventId"
      WHERE p."status"='PAID'
      ORDER BY COALESCE(p."paidAt",p."createdAt") DESC`),
  ]);

  const cancellationByOrder = new Map(cancellations.map(item => [item.orderId, item]));
  const attemptByOrder = new Map(attempts.map(item => [item.orderId, item]));
  const orderById = new Map(orders.map(item => [item.orderId, item]));
  const operations: PlatformFinanceAuditOperation[] = [];

  for (const order of orders) {
    const base = {
      organizationId: order.organizationId,
      organizationName: order.organizationName,
      eventId: order.eventId,
      eventTitle: order.eventTitle,
      orderId: order.orderId,
      publicId: order.publicId,
      createdAt: new Date(order.createdAt),
    };
    operations.push({
      ...base,id:`buyer-${order.orderId}`,kind:"BUYER_PAYMENT",amountMinor:order.buyerTotalMinor,
      description:`Оплата покупателя по заказу ${order.publicId}`,
    });
    operations.push({
      ...base,id:`organizer-${order.orderId}`,kind:"ORGANIZER_SALE",amountMinor:order.organizerNetMinor,
      description:`Заработок организатора по заказу ${order.publicId}`,
    });
    if (order.serviceFeeMinor > 0) operations.push({
      ...base,id:`sales-fee-${order.orderId}`,kind:"ATLAS_SALES_FEE",amountMinor:order.serviceFeeMinor,
      description:`Комиссия Atlas с продажи ${order.publicId}`,
    });

    const cancellation = cancellationByOrder.get(order.orderId);
    const attempt = attemptByOrder.get(order.orderId);
    if (cancellation) {
      const refund = Math.max(0, cancellation.refundAmountMinor || 0);
      if (refund > 0) operations.push({
        ...base,id:`refund-${cancellation.id}`,kind:"REFUND",amountMinor:refund,createdAt:new Date(cancellation.createdAt),
        description:`Фактический возврат клиенту по ${order.publicId}`,
      });
      const fee = Math.max(0, cancellation.statutoryFeeMinor || 0);
      if (fee > 0) operations.push({
        ...base,id:`cancel-fee-${cancellation.id}`,kind:"ATLAS_CANCELLATION_FEE",amountMinor:fee,createdAt:new Date(cancellation.createdAt),
        description:`Комиссия Atlas за отмену ${order.publicId}`,
      });
    } else if (attempt && attempt.totalRefundedMinor > 0) {
      operations.push({
        ...base,id:`refund-attempt-${order.orderId}`,kind:"REFUND",amountMinor:Math.max(0, attempt.totalRefundedMinor),createdAt:new Date(attempt.createdAt),
        description:`Технический/ручной возврат клиенту по ${order.publicId}`,
      });
    }
  }

  for (const item of sms) operations.push({
    id:`sms-${item.id}`,kind:"SERVICE_SMS",organizationId:item.organizationId,organizationName:item.organizationName,
    eventId:item.eventId,eventTitle:item.eventTitle,orderId:item.orderId,publicId:item.publicId,
    amountMinor:item.amountMinor,createdAt:new Date(item.createdAt),
    description:`Платная дополнительная SMS${item.publicId ? ` по заказу ${item.publicId}` : ""} (${item.type})`,
  });

  for (const item of payouts) operations.push({
    id:`payout-${item.id}`,kind:"PAYOUT",organizationId:item.organizationId,organizationName:item.organizationName,
    eventId:item.eventId,eventTitle:item.eventTitle,orderId:null,publicId:item.reference,
    amountMinor:item.amountMinor,createdAt:new Date(item.createdAt),description:`Выплата организатору${item.reference ? ` - ${item.reference}` : ""}`,
  });

  // Ignore refund attempts for orders outside the current paid/cancelled finance scope.
  // This keeps the audit ledger mathematically identical to platformFinanceSummary().
  void orderById;
  return operations.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime());
}
