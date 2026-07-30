import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMarketingRuntime } from "@/lib/marketing-runtime";
import { writeAudit } from "@/lib/audit";

const schema=z.object({
  name:z.string().min(2).max(160),
  channel:z.enum(["EMAIL","SMS","WHATSAPP"]),
  eventId:z.string().nullable().optional(),
  message:z.string().min(3).max(5000),
  segment:z.object({city:z.string().nullable().optional(),minOrders:z.number().int().min(1).max(1000)}),
  estimatedRecipients:z.number().int().min(0),
  estimatedCostMinor:z.number().int().min(0),
});

export async function POST(req:Request){
  try{
    const actor=await requirePermission("ANALYTICS_VIEW");
    if(!actor.organizationId)throw new Error("FORBIDDEN");
    await ensureMarketingRuntime();
    const input=schema.parse(await req.json());
    if(input.eventId){const event=await db.event.findFirst({where:{id:input.eventId,organizationId:actor.organizationId},select:{id:true}});if(!event)throw new Error("Мероприятие не найдено");}
    const id=crypto.randomUUID();
    await db.$executeRawUnsafe(`INSERT INTO MarketingCampaign (id, organizationId, name, type, status, channel, segmentJson, contentJson, estimatedRecipients, estimatedCostMinor, reservedCostMinor, createdById, createdAt, updatedAt) VALUES (?, ?, ?, 'MARKETING', 'DRAFT', ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,id,actor.organizationId,input.name,input.channel,JSON.stringify({...input.segment,eventId:input.eventId??null}),JSON.stringify({message:input.message}),input.estimatedRecipients,input.estimatedCostMinor,actor.id);
    await writeAudit(actor,{action:"MARKETING_CAMPAIGN_DRAFT_CREATE",entityType:"MarketingCampaign",entityId:id,summary:`Создан черновик рассылки ${input.name}`});
    return NextResponse.json({ok:true,id},{status:201});
  }catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});}
}
