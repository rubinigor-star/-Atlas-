import { db } from "@/lib/db";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";
import { ensurePromoterV2Runtime } from "@/lib/promoter-v2";
import { ensurePromoterCheckoutV2Runtime } from "@/lib/promoter-v2-checkout";

export type PromoterV2AnalyticsRow={id:string;name:string;active:boolean;assignments:number;clicks:number;checkouts:number;abandoned:number;recovered:number;orders:number;tickets:number;revenue:number};
export type AssignmentV2AnalyticsRow={id:string;eventId:string;eventTitle:string;eventSlug:string;eventStatus:string;code:string;label:string;active:boolean;clicks:number;checkouts:number;abandoned:number;recovered:number;orders:number;tickets:number;revenue:number};

async function ready(){await Promise.all([ensurePromoterV2Runtime(),ensureAbandonedCheckoutRuntime(),ensurePromoterCheckoutV2Runtime()]);}
function rangeClause(column:string,from?:Date){return from?` AND ${column} >= $2`:""}

export async function promoterV2Analytics(organizationId:string,from?:Date){
 await ready();const params:unknown[]=[organizationId];if(from)params.push(from);
 return db.$queryRawUnsafe<PromoterV2AnalyticsRow[]>(`SELECT p."id",p."name",p."active",
  (SELECT COUNT(*)::int FROM "PromoterEventV2" a WHERE a."promoterId"=p."id") AS assignments,
  (SELECT COUNT(*)::int FROM "PromoterVisitV2" v JOIN "PromoterEventV2" a ON a."id"=v."promoterEventId" WHERE a."promoterId"=p."id"${rangeClause('v."createdAt"',from)}) AS clicks,
  (SELECT COUNT(*)::int FROM "PromoterCheckoutV2" c JOIN "PromoterEventV2" a ON a."id"=c."promoterEventId" WHERE a."promoterId"=p."id"${rangeClause('c."createdAt"',from)}) AS checkouts,
  (SELECT COUNT(*)::int FROM "AbandonedCheckout" ac JOIN "PromoterCheckoutV2" c ON c."token"=ac."token" JOIN "PromoterEventV2" a ON a."id"=c."promoterEventId" WHERE a."promoterId"=p."id" AND ac."abandonedAt" IS NOT NULL${rangeClause('c."createdAt"',from)}) AS abandoned,
  (SELECT COUNT(*)::int FROM "AbandonedCheckout" ac JOIN "PromoterCheckoutV2" c ON c."token"=ac."token" JOIN "PromoterEventV2" a ON a."id"=c."promoterEventId" WHERE a."promoterId"=p."id" AND ac."status"='RECOVERED'${rangeClause('c."createdAt"',from)}) AS recovered,
  (SELECT COUNT(DISTINCT o."id")::int FROM "Order" o JOIN "Referral" r ON r."id"=o."referralId" JOIN "PromoterEventV2" a ON UPPER(a."code")=UPPER(r."code") WHERE a."promoterId"=p."id" AND o."status"='PAID'${rangeClause('o."createdAt"',from)}) AS orders,
  (SELECT COALESCE(SUM(x.qty),0)::int FROM (SELECT o."id",SUM(oi."quantity")::int AS qty FROM "Order" o JOIN "OrderItem" oi ON oi."orderId"=o."id" JOIN "Referral" r ON r."id"=o."referralId" JOIN "PromoterEventV2" a ON UPPER(a."code")=UPPER(r."code") WHERE a."promoterId"=p."id" AND o."status"='PAID'${rangeClause('o."createdAt"',from)} GROUP BY o."id") x) AS tickets,
  (SELECT COALESCE(SUM(o."totalMinor"),0)::int FROM "Order" o JOIN "Referral" r ON r."id"=o."referralId" JOIN "PromoterEventV2" a ON UPPER(a."code")=UPPER(r."code") WHERE a."promoterId"=p."id" AND o."status"='PAID'${rangeClause('o."createdAt"',from)}) AS revenue
 FROM "PromoterV2" p WHERE p."organizationId"=$1 ORDER BY p."active" DESC,LOWER(p."name") ASC`,...params);
}

export async function promoterV2AssignmentAnalytics(promoterId:string,from?:Date){
 await ready();const params:unknown[]=[promoterId];if(from)params.push(from);
 return db.$queryRawUnsafe<AssignmentV2AnalyticsRow[]>(`SELECT a."id",a."eventId",e."title" AS "eventTitle",e."slug" AS "eventSlug",e."status"::text AS "eventStatus",a."code",a."label",a."active",
  (SELECT COUNT(*)::int FROM "PromoterVisitV2" v WHERE v."promoterEventId"=a."id"${rangeClause('v."createdAt"',from)}) AS clicks,
  (SELECT COUNT(*)::int FROM "PromoterCheckoutV2" c WHERE c."promoterEventId"=a."id"${rangeClause('c."createdAt"',from)}) AS checkouts,
  (SELECT COUNT(*)::int FROM "AbandonedCheckout" ac JOIN "PromoterCheckoutV2" c ON c."token"=ac."token" WHERE c."promoterEventId"=a."id" AND ac."abandonedAt" IS NOT NULL${rangeClause('c."createdAt"',from)}) AS abandoned,
  (SELECT COUNT(*)::int FROM "AbandonedCheckout" ac JOIN "PromoterCheckoutV2" c ON c."token"=ac."token" WHERE c."promoterEventId"=a."id" AND ac."status"='RECOVERED'${rangeClause('c."createdAt"',from)}) AS recovered,
  (SELECT COUNT(*)::int FROM "Order" o JOIN "Referral" r ON r."id"=o."referralId" WHERE UPPER(r."code")=UPPER(a."code") AND o."status"='PAID'${rangeClause('o."createdAt"',from)}) AS orders,
  (SELECT COALESCE(SUM(oi."quantity"),0)::int FROM "Order" o JOIN "OrderItem" oi ON oi."orderId"=o."id" JOIN "Referral" r ON r."id"=o."referralId" WHERE UPPER(r."code")=UPPER(a."code") AND o."status"='PAID'${rangeClause('o."createdAt"',from)}) AS tickets,
  (SELECT COALESCE(SUM(o."totalMinor"),0)::int FROM "Order" o JOIN "Referral" r ON r."id"=o."referralId" WHERE UPPER(r."code")=UPPER(a."code") AND o."status"='PAID'${rangeClause('o."createdAt"',from)}) AS revenue
 FROM "PromoterEventV2" a JOIN "Event" e ON e."id"=a."eventId" WHERE a."promoterId"=$1 ORDER BY a."createdAt" DESC`,...params);
}
