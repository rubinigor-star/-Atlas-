import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { invitePromoterAccount } from "@/lib/promoter-auth";
import { writeAudit } from "@/lib/audit";

const schema=z.object({promoterId:z.string().min(1),force:z.boolean().default(false)});

export async function POST(request:Request){
 try{
  const input=schema.parse(await request.json());
  const actor=await requirePermission("EVENT_MANAGE");
  const promoter=await db.promoter.findUnique({where:{id:input.promoterId}});
  if(!promoter||promoter.name.startsWith("__"))return NextResponse.json({error:"Промоутер не найден"},{status:404});
  if(actor.role!=="ADMIN"&&actor.organizationId!==promoter.organizationId)return NextResponse.json({error:"Недостаточно прав"},{status:403});
  const result=await invitePromoterAccount(promoter.id,input.force);
  await writeAudit(actor,{action:"PROMOTER_ACCOUNT_INVITE",entityType:"Promoter",entityId:promoter.id,summary:`Отправлено приглашение в кабинет промоутера ${promoter.name}`});
  return NextResponse.json({ok:true,status:result.status});
 }catch(error){const message=error instanceof Error?error.message:"Ошибка отправки приглашения";console.error('[promoter-account-invite]',error);return NextResponse.json({error:message},{status:400});}
}
