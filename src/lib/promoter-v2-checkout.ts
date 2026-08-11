import { db } from "@/lib/db";
import { findPromoterChannelV2 } from "@/lib/promoter-v2";

let ready:Promise<void>|null=null;
export async function ensurePromoterCheckoutV2Runtime(){if(!ready)ready=(async()=>{await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PromoterCheckoutV2" (
 "token" TEXT PRIMARY KEY,
 "promoterEventId" TEXT NOT NULL,
 "eventId" TEXT NOT NULL,
 "stage" TEXT NOT NULL,
 "amountMinor" INTEGER NOT NULL DEFAULT 0,
 "quantity" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "PromoterCheckoutV2_assignment_fkey" FOREIGN KEY ("promoterEventId") REFERENCES "PromoterEventV2"("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`);await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromoterCheckoutV2_assignment_created_idx" ON "PromoterCheckoutV2"("promoterEventId","createdAt")`);})().catch(e=>{ready=null;throw e});return ready}

export async function capturePromoterCheckoutV2(input:{token:string;eventId:string;referralCode?:string|null;stage:string;amountMinor:number;quantity:number}){
 const code=input.referralCode?.trim();if(!code)return false;await ensurePromoterCheckoutV2Runtime();const link=await findPromoterChannelV2(code);if(!link||!link.active||!link.promoterActive||link.eventId!==input.eventId)return false;
 await db.$executeRawUnsafe(`INSERT INTO "PromoterCheckoutV2" ("token","promoterEventId","eventId","stage","amountMinor","quantity") VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT ("token") DO UPDATE SET "stage"=EXCLUDED."stage","amountMinor"=EXCLUDED."amountMinor","quantity"=EXCLUDED."quantity","updatedAt"=CURRENT_TIMESTAMP`,input.token,link.id,input.eventId,input.stage,input.amountMinor,input.quantity);return true;
}
