import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { getPromoterAccount, invitePromoterAccount } from "@/lib/promoter-auth";
import { writeAudit } from "@/lib/audit";

const schema=z.object({promoterId:z.string().min(1),force:z.boolean().default(false)});

async function authorized(promoterId:string){
 const actor=await requirePermission("EVENT_MANAGE");
 const promoter=await db.promoter.findUnique({where:{id:promoterId}});
 if(!promoter||promoter.name.startsWith("__"))throw new Error("PROMOTER_NOT_FOUND");
 if(actor.role!=="ADMIN"&&actor.organizationId!==promoter.organizationId)throw new Error("FORBIDDEN");
 return {actor,promoter};
}

export async function GET(request:Request){
 try{
  const promoterId=new URL(request.url).searchParams.get("promoterId")||"";
  const {promoter}=await authorized(promoterId);
  const account=await getPromoterAccount(promoter.id);
  return NextResponse.json({ok:true,status:account?.status||"NOT_INVITED",activatedAt:account?.activatedAt||null,lastLoginAt:account?.lastLoginAt||null});
 }catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message},{status:message==="FORBIDDEN"?403:404});}
}

export async function POST(request:Request){
 try{
  const input=schema.parse(await request.json());
  const {actor,promoter}=await authorized(input.promoterId);
  const result=await invitePromoterAccount(promoter.id,input.force);
  await writeAudit(actor,{action:"PROMOTER_ACCOUNT_INVITE",entityType:"Promoter",entityId:promoter.id,summary:`Отправлено приглашение в кабинет промоутера ${promoter.name}`});
  return NextResponse.json({ok:true,status:result.status});
 }catch(error){const message=error instanceof Error?error.message:"Ошибка отправки приглашения";console.error('[promoter-account-invite]',error);return NextResponse.json({error:message},{status:message==="FORBIDDEN"?403:400});}
}
