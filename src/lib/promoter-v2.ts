import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

export type PromoterV2Row = { id:string; organizationId:string; name:string; email:string; phone:string|null; active:boolean; defaultCommissionBps:number; autoAssignAllEvents:boolean; createdAt:Date; updatedAt:Date };
export type PromoterEventV2Row = { id:string; promoterId:string; eventId:string; code:string; label:string; active:boolean; allocationType:"EVENT"|"CATEGORY"|"TABLE"; categoryId:string|null; tableId:string|null; customPriceMinor:number|null; commissionBps:number; startsAt:Date|null; endsAt:Date|null; createdAt:Date; updatedAt:Date };

export async function ensurePromoterV2Runtime(){
 if(!ready) ready=(async()=>{
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterV2" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "defaultCommissionBps" INTEGER NOT NULL DEFAULT 0,
    "autoAssignAllEvents" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoterV2_org_active_idx" ON "PromoterV2"("organizationId","active")`);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromoterV2_org_name_key" ON "PromoterV2"("organizationId",LOWER("name"))`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterEventV2" (
    "id" TEXT PRIMARY KEY,
    "promoterId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "code" TEXT NOT NULL UNIQUE,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "allocationType" TEXT NOT NULL DEFAULT 'EVENT',
    "categoryId" TEXT,
    "tableId" TEXT,
    "customPriceMinor" INTEGER,
    "commissionBps" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoterEventV2_promoter_fkey" FOREIGN KEY ("promoterId") REFERENCES "PromoterV2"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromoterEventV2_event_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromoterEventV2_promoter_event_key" ON "PromoterEventV2"("promoterId","eventId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoterEventV2_event_active_idx" ON "PromoterEventV2"("eventId","active")`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterVisitV2" (
    "id" TEXT PRIMARY KEY,
    "promoterEventId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "source" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoterVisitV2_assignment_fkey" FOREIGN KEY ("promoterEventId") REFERENCES "PromoterEventV2"("id") ON DELETE RESTRICT ON UPDATE CASCADE
  )`);
  await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromoterVisitV2_assignment_session_key" ON "PromoterVisitV2"("promoterEventId","sessionId")`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoterVisitV2_created_idx" ON "PromoterVisitV2"("createdAt")`);
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION atlas_block_promoter_v2_delete() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'PromoterV2 records cannot be deleted; archive them instead'; END; $$ LANGUAGE plpgsql`);
  await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "PromoterV2_block_delete" ON "PromoterV2"`);
  await db.$executeRawUnsafe(`CREATE TRIGGER "PromoterV2_block_delete" BEFORE DELETE ON "PromoterV2" FOR EACH ROW EXECUTE FUNCTION atlas_block_promoter_v2_delete()`);
 })().catch(error=>{ready=null;throw error});
 return ready;
}

function slug(value:string){return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g,"-").replace(/^-+|-+$/g,"").toUpperCase().slice(0,42)||"PROMOTER"}
function codeFor(name:string,eventTitle:string){return `${slug(name)}-${slug(eventTitle)}-${randomUUID().replace(/-/g,"").slice(0,6).toUpperCase()}`.slice(0,96)}

export async function listPromotersV2(organizationId:string){
 await ensurePromoterV2Runtime();
 return db.$queryRawUnsafe<PromoterV2Row[]>(`SELECT * FROM "PromoterV2" WHERE "organizationId"=$1 ORDER BY "active" DESC, LOWER("name") ASC`,organizationId);
}

export async function getPromoterV2(id:string){
 await ensurePromoterV2Runtime();
 const rows=await db.$queryRawUnsafe<PromoterV2Row[]>(`SELECT * FROM "PromoterV2" WHERE "id"=$1 LIMIT 1`,id);return rows[0]||null;
}

export async function createPromoterV2(input:{organizationId:string;name:string;email:string;phone?:string|null;defaultCommissionBps?:number;autoAssignAllEvents?:boolean}){
 await ensurePromoterV2Runtime();
 const id=randomUUID();
 try{await db.$executeRawUnsafe(`INSERT INTO "PromoterV2" ("id","organizationId","name","email","phone","defaultCommissionBps","autoAssignAllEvents") VALUES ($1,$2,$3,$4,$5,$6,$7)`,id,input.organizationId,input.name.trim(),input.email.trim().toLowerCase(),input.phone?.trim()||null,input.defaultCommissionBps||0,Boolean(input.autoAssignAllEvents));}
 catch(error){const existing=await db.$queryRawUnsafe<PromoterV2Row[]>(`SELECT * FROM "PromoterV2" WHERE "organizationId"=$1 AND LOWER("name")=LOWER($2) LIMIT 1`,input.organizationId,input.name.trim());if(existing[0])return existing[0];throw error}
 return (await getPromoterV2(id))!;
}

export async function listAssignmentsV2(promoterId:string){
 await ensurePromoterV2Runtime();
 return db.$queryRawUnsafe<Array<PromoterEventV2Row&{eventTitle:string;eventSlug:string;eventStatus:string;clicks:number}>>(`SELECT a.*,e."title" AS "eventTitle",e."slug" AS "eventSlug",e."status"::text AS "eventStatus",COUNT(v."id")::int AS clicks FROM "PromoterEventV2" a JOIN "Event" e ON e."id"=a."eventId" LEFT JOIN "PromoterVisitV2" v ON v."promoterEventId"=a."id" WHERE a."promoterId"=$1 GROUP BY a."id",e."title",e."slug",e."status" ORDER BY a."createdAt" DESC`,promoterId);
}

export async function assignPromoterV2(promoterId:string,eventId:string){
 await ensurePromoterV2Runtime();
 const p=await getPromoterV2(promoterId);if(!p||!p.active)throw new Error("PROMOTER_NOT_FOUND");
 const ev=await db.event.findUnique({where:{id:eventId},select:{id:true,title:true,organizationId:true}});if(!ev||ev.organizationId!==p.organizationId)throw new Error("EVENT_NOT_FOUND");
 const existing=await db.$queryRawUnsafe<PromoterEventV2Row[]>(`SELECT * FROM "PromoterEventV2" WHERE "promoterId"=$1 AND "eventId"=$2 LIMIT 1`,promoterId,eventId);if(existing[0])return existing[0];
 const id=randomUUID(),code=codeFor(p.name,ev.title),label=`${p.name} · ${ev.title}`;
 await db.$executeRawUnsafe(`INSERT INTO "PromoterEventV2" ("id","promoterId","eventId","code","label","commissionBps") VALUES ($1,$2,$3,$4,$5,$6)`,id,promoterId,eventId,code,label,p.defaultCommissionBps);
 const rows=await db.$queryRawUnsafe<PromoterEventV2Row[]>(`SELECT * FROM "PromoterEventV2" WHERE "id"=$1`,id);return rows[0];
}

export async function setPromoterV2Active(id:string,active:boolean){await ensurePromoterV2Runtime();await db.$executeRawUnsafe(`UPDATE "PromoterV2" SET "active"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,id,active);return getPromoterV2(id)}
export async function setPromoterV2Automation(id:string,value:boolean){await ensurePromoterV2Runtime();await db.$executeRawUnsafe(`UPDATE "PromoterV2" SET "autoAssignAllEvents"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,id,value)}

export async function findPromoterChannelV2(code:string){
 await ensurePromoterV2Runtime();
 const rows=await db.$queryRawUnsafe<Array<PromoterEventV2Row&{promoterName:string;promoterActive:boolean}>>(`SELECT a.*,p."name" AS "promoterName",p."active" AS "promoterActive" FROM "PromoterEventV2" a JOIN "PromoterV2" p ON p."id"=a."promoterId" WHERE UPPER(a."code")=UPPER($1) LIMIT 1`,code);return rows[0]||null;
}

export async function trackPromoterVisitV2(input:{code:string;eventId:string;sessionId:string;source?:string|null;utmSource?:string|null;utmMedium?:string|null;utmCampaign?:string|null;userAgent?:string|null}){
 const link=await findPromoterChannelV2(input.code);const now=new Date();if(!link||!link.active||!link.promoterActive||link.eventId!==input.eventId||(link.startsAt&&link.startsAt>now)||(link.endsAt&&link.endsAt<now))return false;
 await db.$executeRawUnsafe(`INSERT INTO "PromoterVisitV2" ("id","promoterEventId","sessionId","source","utmSource","utmMedium","utmCampaign","userAgent") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("promoterEventId","sessionId") DO NOTHING`,randomUUID(),link.id,input.sessionId,input.source||null,input.utmSource||null,input.utmMedium||null,input.utmCampaign||null,input.userAgent||null);return true;
}
