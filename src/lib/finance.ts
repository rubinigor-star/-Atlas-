import { db } from "@/lib/db";
import { ensureCancellationRuntime } from "@/lib/cancellations";

export type FinanceEventRow = {
  eventId: string;
  eventTitle: string;
  eventStartsAt: Date;
  posterUrl: string;
  organizationId: string;
  organizationName?: string;
  salesMinor: number;
  refundsMinor: number;
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
  type: "SALE" | "REFUND" | "PAYOUT";
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

type PayoutRow = { id:string; eventId: string; amountMinor: number; status: string; paidAt:Date|null; createdAt:Date; reference:string|null };

let runtime: Promise<void> | null = null;
export function ensureFinanceRuntime() {
  if (!runtime) runtime = (async () => {
    await ensureCancellationRuntime();
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
  return new Date(saleDate.getFullYear(), saleDate.getMonth() + 1, 6, 9, 0, 0, 0);
}

export function payoutDateForEvent(eventDate: Date) {
  return new Date(eventDate.getFullYear(), eventDate.getMonth() + 1, 7, 9, 0, 0, 0);
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

async function payoutRows(organizationId?: string): Promise<PayoutRow[]> {
  await ensureFinanceRuntime();
  const scope = organizationId ? `WHERE "organizationId"=$1 AND "status"='PAID'` : `WHERE "status"='PAID'`;
  const params = organizationId ? [organizationId] : [];
  return db.$queryRawUnsafe<PayoutRow[]>(`SELECT "id","eventId","amountMinor","status","paidAt","createdAt","reference" FROM "OrganizerPayout" ${scope}`, ...params);
}

export async function financeEvents(organizationId?: string): Promise<FinanceEventRow[]> {
  const [orders, refunds, payouts] = await Promise.all([financeOrders(organizationId), refundRows(organizationId), payoutRows(organizationId)]);
  const now = new Date();
  const paidByEvent = new Map<string, number>();
  for (const payout of payouts) paidByEvent.set(payout.eventId, (paidByEvent.get(payout.eventId) || 0) + payout.amountMinor);

  const grouped = new Map<string, FinanceEventRow>();
  for (const order of orders) {
    let row = grouped.get(order.eventId);
    if (!row) {
      row = {
        eventId: order.eventId,eventTitle:order.eventTitle,eventStartsAt:new Date(order.eventStartsAt),posterUrl:order.posterUrl,
        organizationId:order.organizationId,organizationName:order.organizationName,salesMinor:0,refundsMinor:0,balanceMinor:0,
        settledMinor:0,awaitingSettlementMinor:0,paidOutMinor:paidByEvent.get(order.eventId)||0,availableMinor:0,buyerPaidMinor:0,
        atlasSalesFeeMinor:0,atlasCancellationFeeMinor:0,payoutDate:payoutDateForEvent(new Date(order.eventStartsAt)),status:"PLANNED",
      };
      grouped.set(order.eventId,row);
    }
    row.salesMinor += order.organizerNetMinor;
    row.buyerPaidMinor += order.buyerTotalMinor;
    row.atlasSalesFeeMinor += order.serviceFeeMinor;
    const refund = refunds.get(order.orderId);
    const organizerRefundImpact = refund ? order.organizerNetMinor + Math.max(0, refund.organizerChargeMinor || 0) : 0;
    row.refundsMinor += organizerRefundImpact;
    if (refund) row.atlasCancellationFeeMinor += refund.statutoryFeeMinor;
    const netForOrder = order.organizerNetMinor - organizerRefundImpact;
    if (settlementDateForSale(new Date(order.createdAt)) <= now) row.settledMinor += netForOrder;
    else row.awaitingSettlementMinor += netForOrder;
  }

  for (const row of grouped.values()) {
    row.balanceMinor = Math.max(0,row.salesMinor-row.refundsMinor);
    const eventFinished = row.eventStartsAt <= now;
    row.availableMinor = eventFinished ? Math.max(0,row.settledMinor-row.paidOutMinor) : 0;
    if (row.paidOutMinor >= row.balanceMinor && row.balanceMinor > 0) row.status="PAID";
    else if (eventFinished && row.availableMinor > 0) row.status="AVAILABLE";
  }
  return [...grouped.values()].sort((a,b)=>a.eventStartsAt.getTime()-b.eventStartsAt.getTime());
}

export async function organizerFinanceSummary(organizationId: string) {
  const events = await financeEvents(organizationId);
  return {
    events,
    salesMinor: events.reduce((s,e)=>s+e.salesMinor,0),
    refundsMinor: events.reduce((s,e)=>s+e.refundsMinor,0),
    balanceMinor: events.reduce((s,e)=>s+e.balanceMinor,0),
    availableMinor: events.reduce((s,e)=>s+e.availableMinor,0),
    awaitingSettlementMinor: events.reduce((s,e)=>s+Math.max(0,e.awaitingSettlementMinor),0),
    paidOutMinor: events.reduce((s,e)=>s+e.paidOutMinor,0),
  };
}

export async function organizerFinanceEvent(organizationId:string,eventId:string){
  const [events,orders,refunds,payouts]=await Promise.all([financeEvents(organizationId),financeOrders(organizationId),refundRows(organizationId),payoutRows(organizationId)]);
  const event=events.find(item=>item.eventId===eventId);
  if(!event)return null;
  const transactions:FinanceTransaction[]=[];
  for(const order of orders.filter(item=>item.eventId===eventId)){
    transactions.push({id:order.orderId,type:"SALE",publicId:order.publicId,createdAt:new Date(order.createdAt),amountMinor:order.organizerNetMinor,description:"Продажа билетов"});
    const refund=refunds.get(order.orderId);
    if(refund){const impact=order.organizerNetMinor+Math.max(0,refund.organizerChargeMinor||0);transactions.push({id:refund.id,type:"REFUND",publicId:refund.publicId,createdAt:new Date(refund.createdAt),amountMinor:-impact,description:`Возврат по заказу ${order.publicId}`});}
  }
  for(const payout of payouts.filter(item=>item.eventId===eventId))transactions.push({id:payout.id,type:"PAYOUT",publicId:payout.reference||"Выплата",createdAt:new Date(payout.paidAt||payout.createdAt),amountMinor:-payout.amountMinor,description:"Выплата организатору"});
  transactions.sort((a,b)=>b.createdAt.getTime()-a.createdAt.getTime());
  return {event,transactions};
}

export async function platformFinanceSummary() {
  const events = await financeEvents();
  const byOrganization = new Map<string,{organizationId:string;organizationName:string;salesMinor:number;refundsMinor:number;balanceMinor:number;availableMinor:number;buyerPaidMinor:number;atlasRevenueMinor:number;eventCount:number}>();
  for (const event of events) {
    const row=byOrganization.get(event.organizationId)||{organizationId:event.organizationId,organizationName:event.organizationName||"Организатор",salesMinor:0,refundsMinor:0,balanceMinor:0,availableMinor:0,buyerPaidMinor:0,atlasRevenueMinor:0,eventCount:0};
    row.salesMinor+=event.salesMinor;row.refundsMinor+=event.refundsMinor;row.balanceMinor+=event.balanceMinor;row.availableMinor+=event.availableMinor;
    row.buyerPaidMinor+=event.buyerPaidMinor;row.atlasRevenueMinor+=event.atlasSalesFeeMinor+event.atlasCancellationFeeMinor;row.eventCount+=1;
    byOrganization.set(event.organizationId,row);
  }
  const organizations=[...byOrganization.values()].sort((a,b)=>b.balanceMinor-a.balanceMinor);
  return {
    events,organizations,
    buyerPaidMinor:events.reduce((s,e)=>s+e.buyerPaidMinor,0),
    organizerLiabilityMinor:events.reduce((s,e)=>s+e.balanceMinor-e.paidOutMinor,0),
    atlasSalesFeeMinor:events.reduce((s,e)=>s+e.atlasSalesFeeMinor,0),
    atlasCancellationFeeMinor:events.reduce((s,e)=>s+e.atlasCancellationFeeMinor,0),
    availableForPayoutMinor:events.reduce((s,e)=>s+e.availableMinor,0),
  };
}
