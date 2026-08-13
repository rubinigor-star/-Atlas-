import { db } from "@/lib/db";
import { ensureCancellationRuntime } from "@/lib/cancellations";
import { ensureNotificationLedger } from "@/lib/notification-ledger";

export type FinanceEventRow = {
  eventId: string;
  eventTitle: string;
  eventStartsAt: Date;
  posterUrl: string;
  organizationId: string;
  organizationName?: string;
  salesMinor: number;
  refundsMinor: number;
  servicesMinor: number;
  balanceMinor: number;
  settledMinor: number;
  awaitingSettlementMinor: number;
  paidOutMinor: number;
  availableMinor: number;
  buyerPaidMinor: number;
  atlasSalesFeeMinor: number;
  atlasCancellationFeeMinor: number;
  payoutDate: Date;
  status: "PLANNED" | "AVAILABLE" | "PAID";
};

export type FinanceTransaction = {
  id: string;
  type: "SALE" | "REFUND" | "SERVICE" | "PAYOUT";
  publicId: string;
  createdAt: Date;
  amountMinor: number;
  description: string;
};

type FinanceOrderRow = {
  orderId: string;
  publicId: string;
  eventId: string;
  eventTitle: string;
  eventStartsAt: Date;
  posterUrl: string;
  organizationId: string;
  organizationName: string;
  status: string;
  createdAt: Date;
  buyerTotalMinor: number;
  organizerNetMinor: number;
  serviceFeeMinor: number;
};

type RefundRow = {
  id: string;
  publicId: string;
  orderId: string;
  refundAmountMinor: number | null;
  statutoryFeeMinor: number;
  organizerChargeMinor: number | null;
  createdAt: Date;
};

type RefundAttemptTotal = { orderId: string; totalRefundedMinor: number; createdAt: Date };
type PayoutRow = { id: string; eventId: string; amountMinor: number; status: string; paidAt: Date | null; createdAt: Date; reference: string | null };
type SmsChargeRow = { organizationId: string; eventId: string | null; amountMinor: number; sentCount: number; createdAt: Date };

let runtime: Promise<void> | null = null;
export function ensureFinanceRuntime() {
  if (!runtime) runtime = (async () => {
    await Promise.all([ensureCancellationRuntime(), ensureNotificationLedger()]);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderCommercialSnapshot" (
      "orderId" TEXT PRIMARY KEY,
      "subtotalMinor" INTEGER NOT NULL,
      "serviceFeeMinor" INTEGER NOT NULL,
      "buyerTotalMinor" INTEGER NOT NULL,
      "organizerNetMinor" INTEGER NOT NULL,
      "serviceFeePayer" TEXT NOT NULL,
      "salesFeePercentBps" INTEGER NOT NULL,
      "salesFeeFixedMinor" INTEGER NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrganizerPayout" (
      "id" TEXT PRIMARY KEY,
      "organizationId" TEXT NOT NULL,
      "eventId" TEXT NOT NULL,
      "amountMinor" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PAID',
      "paidAt" TIMESTAMP(3),
      "reference" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrganizerPayout_org_event_idx" ON "OrganizerPayout"("organizationId","eventId","createdAt")`);
  })().catch(error => { runtime = null; throw error; });
  return runtime;
}

function settlementDateForSale(saleDate: Date) {
  return new Date(Date.UTC(saleDate.getUTCFullYear(), saleDate.getUTCMonth() + 1, 6, 0, 0, 0));
}

export function payoutDateForEvent(eventDate: Date) {
  return new Date(Date.UTC(eventDate.getUTCFullYear(), eventDate.getUTCMonth() + 1, 7, 0, 0, 0));
}

async function financeOrders(organizationId?: string): Promise<FinanceOrderRow[]> {
  await ensureFinanceRuntime();
  const scope = organizationId ? `AND e."organizationId"=$1` : "";
  const params = organizationId ? [organizationId] : [];
  return db.$queryRawUnsafe<FinanceOrderRow[]>(`
    SELECT o."id" AS "orderId",o."publicId",o."eventId",e."title" AS "eventTitle",e."startsAt" AS "eventStartsAt",
      e."posterUrl",e."organizationId",org."name" AS "organizationName",o."status",o."createdAt",
      COALESCE(s."buyerTotalMinor",o."totalMinor")::int AS "buyerTotalMinor",
      COALESCE(s."organizerNetMinor",o."totalMinor")::int AS "organizerNetMinor",
      COALESCE(s."serviceFeeMinor",0)::int AS "serviceFeeMinor"
    FROM "Order" o
    JOIN "Event" e ON e."id"=o."eventId"
    JOIN "Organization" org ON org."id"=e."organizationId"
    LEFT JOIN "OrderCommercialSnapshot" s ON s."orderId"=o."id"
    WHERE o."status" IN ('PAID','CANCELLED') ${scope}
    ORDER BY o."createdAt" DESC`, ...params);
}

async function refundRows(organizationId?: string): Promise<Map<string, RefundRow>> {
  await ensureFinanceRuntime();
  const scope = organizationId ? `AND c."organizationId"=$1` : "";
  const params = organizationId ? [organizationId] : [];
  const rows = await db.$queryRawUnsafe<RefundRow[]>(`
    SELECT c."id",c."publicId",c."orderId",c."refundAmountMinor",c."statutoryFeeMinor",c."organizerChargeMinor",c."updatedAt" AS "createdAt"
    FROM "CancellationRequest" c WHERE c."status"='REFUNDED' ${scope}`, ...params);
  return new Map(rows.map(row => [row.orderId, row]));
}

async function successfulRefundAttempts(organizationId?: string): Promise<Map<string, RefundAttemptTotal>> {
  await ensureFinanceRuntime();
  const scope = organizationId ? `AND e."organizationId"=$1` : "";
  const params = organizationId ? [organizationId] : [];
  const rows = await db.$queryRawUnsafe<RefundAttemptTotal[]>(`
    SELECT r."orderId",SUM(r."amountMinor")::int AS "totalRefundedMinor",MAX(COALESCE(r."completedAt",r."updatedAt",r."createdAt")) AS "createdAt"
    FROM "RefundAttempt" r
    JOIN "Order" o ON o."id"=r."orderId"
    JOIN "Event" e ON e."id"=o."eventId"
    WHERE r."status"='SUCCEEDED' ${scope}
    GROUP BY r."orderId"`, ...params).catch(() => [] as RefundAttemptTotal[]);
  return new Map(rows.map(row => [row.orderId, row]));
}

async function payoutRows(organizationId?: string): Promise<PayoutRow[]> {
  await ensureFinanceRuntime();
  const scope = organizationId ? `WHERE "organizationId"=$1 AND "status"='PAID'` : `WHERE "status"='PAID'`;
  const params = organizationId ? [organizationId] : [];
  return db.$queryRawUnsafe<PayoutRow[]>(`SELECT "id","eventId","amountMinor","status","paidAt","createdAt","reference" FROM "OrganizerPayout" ${scope}`, ...params);
}

async function smsChargeRows(organizationId?: string): Promise<SmsChargeRow[]> {
  await ensureFinanceRuntime();
  const scope = organizationId ? `AND n."organizationId"=$1` : "";
  const params = organizationId ? [organizationId] : [];
  return db.$queryRawUnsafe<SmsChargeRow[]>(`
    SELECT n."organizationId",o."eventId",COALESCE(SUM(n."priceMinor"),0)::int AS "amountMinor",
      COUNT(*)::int AS "sentCount",MAX(COALESCE(n."sentAt",n."createdAt")) AS "createdAt"
    FROM "NotificationDelivery" n
    LEFT JOIN "Order" o ON o."id"=n."orderId"
    WHERE n."channel"='SMS' AND n."status"='SENT' AND n."organizationId" IS NOT NULL ${scope}
    GROUP BY n."organizationId",o."eventId"`, ...params);
}

function cancellationRefundImpact(cancellation: RefundRow) {
  const refundAmount = Math.max(0, cancellation.refundAmountMinor || 0);
  // A cancellation creates two organizer-side debits: the money actually
  // returned to the buyer and the cancellation fee. The original sales fee
  // remains Atlas revenue and is intentionally NOT subtracted here.
  return refundAmount + Math.max(0, cancellation.statutoryFeeMinor);
}

function organizerRefundImpact(cancellation: RefundRow | undefined, attempt: RefundAttemptTotal | undefined) {
  if (cancellation) return cancellationRefundImpact(cancellation);
  // A technical/manual refund without CancellationRequest reduces the amount
  // Atlas owes the organizer by the full amount actually refunded. Do not cap
  // it at organizerNet - negative organizer balances must remain visible and
  // be carried against future payouts.
  if (attempt) return Math.max(0, attempt.totalRefundedMinor);
  return 0;
}

export async function financeEvents(organizationId?: string): Promise<FinanceEventRow[]> {
  const [orders, refunds, refundAttempts, payouts, smsCharges] = await Promise.all([
    financeOrders(organizationId), refundRows(organizationId), successfulRefundAttempts(organizationId), payoutRows(organizationId), smsChargeRows(organizationId),
  ]);
  const now = new Date();
  const paidByEvent = new Map<string, number>();
  const smsByEvent = new Map<string, number>();
  for (const payout of payouts) paidByEvent.set(payout.eventId, (paidByEvent.get(payout.eventId) || 0) + payout.amountMinor);
  for (const sms of smsCharges) if (sms.eventId) smsByEvent.set(sms.eventId, (smsByEvent.get(sms.eventId) || 0) + sms.amountMinor);

  const grouped = new Map<string, FinanceEventRow>();
  for (const order of orders) {
    let row = grouped.get(order.eventId);
    if (!row) {
      row = {
        eventId: order.eventId,eventTitle: order.eventTitle,eventStartsAt: new Date(order.eventStartsAt),posterUrl: order.posterUrl,
        organizationId: order.organizationId,organizationName: order.organizationName,salesMinor: 0,refundsMinor: 0,servicesMinor: smsByEvent.get(order.eventId) || 0,balanceMinor: 0,
        settledMinor: 0,awaitingSettlementMinor: 0,paidOutMinor: paidByEvent.get(order.eventId) || 0,availableMinor: 0,buyerPaidMinor: 0,
        atlasSalesFeeMinor: 0,atlasCancellationFeeMinor: 0,payoutDate: payoutDateForEvent(new Date(order.eventStartsAt)),status: "PLANNED",
      };
      grouped.set(order.eventId, row);
    }

    row.salesMinor += order.organizerNetMinor;
    row.buyerPaidMinor += order.buyerTotalMinor;
    const cancellation = refunds.get(order.orderId);
    const refundAttempt = refundAttempts.get(order.orderId);
    const refundImpact = organizerRefundImpact(cancellation, refundAttempt);
    row.refundsMinor += refundImpact;

    // Sales commission is earned on every successful sale, including a sale
    // that is later cancelled. Cancellation fee is an additional Atlas fee.
    row.atlasSalesFeeMinor += order.serviceFeeMinor;
    if (cancellation) row.atlasCancellationFeeMinor += Math.max(0, cancellation.statutoryFeeMinor);

    const netForOrder = order.organizerNetMinor - refundImpact;
    if (settlementDateForSale(new Date(order.createdAt)) <= now) row.settledMinor += netForOrder;
    else row.awaitingSettlementMinor += netForOrder;
  }

  for (const row of grouped.values()) {
    row.balanceMinor = row.salesMinor - row.refundsMinor - row.servicesMinor;
    const payoutCycleReached = now >= row.payoutDate;
    row.availableMinor = payoutCycleReached ? Math.max(0, row.settledMinor - row.servicesMinor - row.paidOutMinor) : 0;
    if (row.paidOutMinor >= Math.max(0, row.balanceMinor) && row.balanceMinor > 0) row.status = "PAID";
    else if (payoutCycleReached && row.availableMinor > 0) row.status = "AVAILABLE";
  }
  return [...grouped.values()].sort((a, b) => a.eventStartsAt.getTime() - b.eventStartsAt.getTime());
}

function organizationAvailability(events: FinanceEventRow[], unallocatedServicesMinor = 0) {
  const positiveAvailable = events.reduce((sum, event) => sum + Math.max(0, event.availableMinor), 0);
  // Negative remaining balances are real organizer debt. They must reduce a
  // later payout from another event instead of disappearing at event level.
  const negativeRemaining = events.reduce((sum, event) => {
    const remaining = event.balanceMinor - event.paidOutMinor;
    return sum + Math.min(0, remaining);
  }, 0);
  return Math.max(0, positiveAvailable + negativeRemaining - Math.max(0, unallocatedServicesMinor));
}

export async function organizerFinanceSummary(organizationId: string) {
  const [events, smsCharges] = await Promise.all([financeEvents(organizationId), smsChargeRows(organizationId)]);
  const eventServices = events.reduce((s, e) => s + e.servicesMinor, 0);
  const allServices = smsCharges.reduce((s, row) => s + row.amountMinor, 0);
  const unallocatedServicesMinor = Math.max(0, allServices - eventServices);
  return {
    events,
    salesMinor: events.reduce((s, e) => s + e.salesMinor, 0),
    refundsMinor: events.reduce((s, e) => s + e.refundsMinor, 0),
    servicesMinor: allServices,
    unallocatedServicesMinor,
    balanceMinor: events.reduce((s, e) => s + e.balanceMinor, 0) - unallocatedServicesMinor,
    availableMinor: organizationAvailability(events, unallocatedServicesMinor),
    awaitingSettlementMinor: events.reduce((s, e) => s + Math.max(0, e.awaitingSettlementMinor), 0),
    paidOutMinor: events.reduce((s, e) => s + e.paidOutMinor, 0),
  };
}

export async function organizerFinanceEvent(organizationId: string, eventId: string) {
  const [events, orders, refunds, refundAttempts, payouts, smsCharges] = await Promise.all([
    financeEvents(organizationId),financeOrders(organizationId),refundRows(organizationId),successfulRefundAttempts(organizationId),payoutRows(organizationId),smsChargeRows(organizationId),
  ]);
  const event = events.find(item => item.eventId === eventId);
  if (!event) return null;
  const transactions: FinanceTransaction[] = [];

  for (const order of orders.filter(item => item.eventId === eventId)) {
    transactions.push({ id: order.orderId,type: "SALE",publicId: order.publicId,createdAt: new Date(order.createdAt),amountMinor: order.organizerNetMinor,description: "Продажа билетов" });
    const cancellation = refunds.get(order.orderId);
    const attempt = refundAttempts.get(order.orderId);
    const impact = organizerRefundImpact(cancellation, attempt);
    if (impact > 0) transactions.push({
      id: cancellation?.id || `refund-${order.orderId}`,type: "REFUND",publicId: cancellation?.publicId || order.publicId,
      createdAt: new Date(cancellation?.createdAt || attempt!.createdAt),amountMinor: -impact,
      description: cancellation ? `Возврат клиенту и комиссия отмены по ${order.publicId}` : `Возврат по заказу ${order.publicId}`,
    });
  }

  for (const sms of smsCharges.filter(item => item.eventId === eventId && item.amountMinor > 0)) transactions.push({
    id: `sms-${eventId}`,type: "SERVICE",publicId: `${sms.sentCount} SMS`,createdAt: new Date(sms.createdAt),amountMinor: -sms.amountMinor,description: "Дополнительная услуга: отправка SMS",
  });
  for (const payout of payouts.filter(item => item.eventId === eventId)) transactions.push({
    id: payout.id,type: "PAYOUT",publicId: payout.reference || "Выплата",createdAt: new Date(payout.paidAt || payout.createdAt),amountMinor: -payout.amountMinor,description: "Выплата организатору",
  });
  transactions.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return { event, transactions };
}

export async function platformFinanceSummary() {
  const [events, smsCharges] = await Promise.all([financeEvents(), smsChargeRows()]);
  const allSmsMinor = smsCharges.reduce((s, row) => s + row.amountMinor, 0);
  const smsByOrganization = new Map<string, number>();
  for (const sms of smsCharges) smsByOrganization.set(sms.organizationId, (smsByOrganization.get(sms.organizationId) || 0) + sms.amountMinor);
  const eventSmsByOrganization = new Map<string, number>();
  for (const event of events) eventSmsByOrganization.set(event.organizationId, (eventSmsByOrganization.get(event.organizationId) || 0) + event.servicesMinor);

  const byOrganization = new Map<string, {organizationId:string;organizationName:string;salesMinor:number;refundsMinor:number;servicesMinor:number;balanceMinor:number;availableMinor:number;buyerPaidMinor:number;atlasRevenueMinor:number;eventCount:number}>();
  for (const event of events) {
    const row = byOrganization.get(event.organizationId) || {organizationId:event.organizationId,organizationName:event.organizationName||"Организатор",salesMinor:0,refundsMinor:0,servicesMinor:0,balanceMinor:0,availableMinor:0,buyerPaidMinor:0,atlasRevenueMinor:0,eventCount:0};
    row.salesMinor += event.salesMinor;
    row.refundsMinor += event.refundsMinor;
    row.servicesMinor += event.servicesMinor;
    row.balanceMinor += event.balanceMinor;
    row.buyerPaidMinor += event.buyerPaidMinor;
    row.atlasRevenueMinor += event.atlasSalesFeeMinor + event.atlasCancellationFeeMinor + event.servicesMinor;
    row.eventCount += 1;
    byOrganization.set(event.organizationId, row);
  }
  for (const [organizationId,totalSms] of smsByOrganization) {
    const unallocated = Math.max(0, totalSms - (eventSmsByOrganization.get(organizationId) || 0));
    const row = byOrganization.get(organizationId);
    if (!row) continue;
    if (unallocated) {
      row.servicesMinor += unallocated;
      row.balanceMinor -= unallocated;
      row.atlasRevenueMinor += unallocated;
    }
    const organizationEvents = events.filter(event => event.organizationId === organizationId);
    row.availableMinor = organizationAvailability(organizationEvents, unallocated);
  }
  // Organizations without SMS still need debt-adjusted availability.
  for (const row of byOrganization.values()) {
    if (!smsByOrganization.has(row.organizationId)) {
      row.availableMinor = organizationAvailability(events.filter(event => event.organizationId === row.organizationId), 0);
    }
  }

  const organizations = [...byOrganization.values()].sort((a, b) => b.balanceMinor - a.balanceMinor);
  return {
    events,organizations,
    buyerPaidMinor: events.reduce((s, e) => s + e.buyerPaidMinor, 0),
    organizerLiabilityMinor: organizations.reduce((s, org) => s + org.balanceMinor, 0) - events.reduce((s,e)=>s+e.paidOutMinor,0),
    atlasSalesFeeMinor: events.reduce((s, e) => s + e.atlasSalesFeeMinor, 0),
    atlasCancellationFeeMinor: events.reduce((s, e) => s + e.atlasCancellationFeeMinor, 0),
    atlasServicesMinor: allSmsMinor,
    availableForPayoutMinor: organizations.reduce((s, org) => s + org.availableMinor, 0),
  };
}
