import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { ensureMarketingRuntime } from "@/lib/marketing-runtime";

const channelSchema=z.enum(["EMAIL","SMS","WHATSAPP"]);
const schema=z.discriminatedUnion("action",[
  z.object({action:z.literal("GRANT"),guestId:z.string().min(1),channel:channelSchema,consentTextVersion:z.string().min(1).max(80),proofNote:z.string().max(500).optional()}),
  z.object({action:z.literal("SUPPRESS"),guestId:z.string().min(1),channel:channelSchema.nullable().optional(),reason:z.string().min(2).max(200)}),
]);

export async function POST(req:Request){
  try{
    const actor=await requirePermission("ANALYTICS_VIEW");
    const organizationId=actor.organizationId!;
    const input=schema.parse(await req.json());
    await ensureMarketingRuntime();

    const guest=await db.guestProfile.findFirst({where:{id:input.guestId,organizationId},select:{id:true,firstName:true,lastName:true}});
    if(!guest)return NextResponse.json({error:"Клиент не найден у этого организатора"},{status:404});

    if(input.action==="GRANT"){
      const activeSuppression=await db.$queryRawUnsafe<Array<{id:string}>>(`SELECT id FROM MarketingSuppression WHERE organizationId=? AND guestId=? AND releasedAt IS NULL AND (channel IS NULL OR channel=?) LIMIT 1`,organizationId,input.guestId,input.channel);
      if(activeSuppression.length)return NextResponse.json({error:"Сначала необходимо снять действующий запрет на маркетинг. Повторное согласие требует отдельного подтверждённого процесса."},{status:409});
      await db.$executeRawUnsafe(`INSERT INTO MarketingConsent (id,organizationId,guestId,channel,status,purpose,source,consentTextVersion,proofJson,grantedAt,revokedAt,createdAt,updatedAt) VALUES (?,?,?,?, 'GRANTED','MARKETING','ORGANIZER_MANUAL',?,?,CURRENT_TIMESTAMP,NULL,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(organizationId,guestId,channel,purpose) DO UPDATE SET status='GRANTED',source='ORGANIZER_MANUAL',consentTextVersion=excluded.consentTextVersion,proofJson=excluded.proofJson,grantedAt=CURRENT_TIMESTAMP,revokedAt=NULL,updatedAt=CURRENT_TIMESTAMP`,crypto.randomUUID(),organizationId,input.guestId,input.channel,input.consentTextVersion,JSON.stringify({note:input.proofNote??null,actorId:actor.id}));
      await writeAudit(actor,{action:"MARKETING_CONSENT_GRANT",entityType:"GuestProfile",entityId:input.guestId,summary:`Зафиксировано согласие ${input.channel} для ${guest.firstName} ${guest.lastName}`});
      return NextResponse.json({ok:true,status:"GRANTED"});
    }

    const channel=input.channel??null;
    await db.$executeRawUnsafe(`INSERT INTO MarketingSuppression (id,organizationId,guestId,channel,scope,reason,source,createdAt,releasedAt) VALUES (?,?,?,?, 'ORGANIZER_MARKETING',?,'ORGANIZER_MANUAL',CURRENT_TIMESTAMP,NULL)`,crypto.randomUUID(),organizationId,input.guestId,channel,input.reason);
    if(channel){
      await db.$executeRawUnsafe(`UPDATE MarketingConsent SET status='REVOKED',revokedAt=CURRENT_TIMESTAMP,updatedAt=CURRENT_TIMESTAMP WHERE organizationId=? AND guestId=? AND channel=? AND purpose='MARKETING'`,organizationId,input.guestId,channel);
    }else{
      await db.$executeRawUnsafe(`UPDATE MarketingConsent SET status='REVOKED',revokedAt=CURRENT_TIMESTAMP,updatedAt=CURRENT_TIMESTAMP WHERE organizationId=? AND guestId=? AND purpose='MARKETING'`,organizationId,input.guestId);
    }
    await writeAudit(actor,{action:"MARKETING_SUPPRESS",entityType:"GuestProfile",entityId:input.guestId,summary:`Клиент ${guest.firstName} ${guest.lastName} исключён из ${channel??"всех"} рекламных рассылок`});
    return NextResponse.json({ok:true,status:"SUPPRESSED"});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({error:message},{status:400});
  }
}
