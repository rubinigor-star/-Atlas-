import { db } from "@/lib/db";
import { assignPromoterV2, ensurePromoterV2Runtime, type PromoterEventV2Row } from "@/lib/promoter-v2";

export async function ensurePromoterV2OrderReferral(assignment:PromoterEventV2Row){
 await db.referral.upsert({where:{code:assignment.code},create:{code:assignment.code,label:assignment.label,eventId:assignment.eventId},update:{label:assignment.label,eventId:assignment.eventId}});
}

export async function assignPromoterV2WithReferral(promoterId:string,eventId:string){
 const assignment=await assignPromoterV2(promoterId,eventId);await ensurePromoterV2OrderReferral(assignment);return assignment;
}

export async function assignAutoPromotersV2ToEvent(eventId:string){
 await ensurePromoterV2Runtime();const event=await db.event.findUnique({where:{id:eventId},select:{organizationId:true}});if(!event)return 0;
 const rows=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT "id" FROM "PromoterV2" WHERE "organizationId"=$1 AND "active"=TRUE AND "autoAssignAllEvents"=TRUE`,event.organizationId);
 for(const row of rows)await assignPromoterV2WithReferral(row.id,eventId);return rows.length;
}

export async function copyPromotersV2ToEvent(sourceEventId:string,targetEventId:string){
 await ensurePromoterV2Runtime();const source=await db.event.findUnique({where:{id:sourceEventId},select:{organizationId:true}}),target=await db.event.findUnique({where:{id:targetEventId},select:{organizationId:true}});if(!source||!target||source.organizationId!==target.organizationId)return 0;
 const rows=await db.$queryRawUnsafe<Array<{promoterId:string}>>(`SELECT DISTINCT a."promoterId" FROM "PromoterEventV2" a JOIN "PromoterV2" p ON p."id"=a."promoterId" WHERE a."eventId"=$1 AND p."active"=TRUE`,sourceEventId);
 for(const row of rows)await assignPromoterV2WithReferral(row.promoterId,targetEventId);return rows.length;
}
