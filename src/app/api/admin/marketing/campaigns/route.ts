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
  estimatedRecipients:z.number().int().min(0).optional(),
  estimatedCostMinor:z.number().int().min(0).optional(),
});

type ConsentRow={guestId:string;source:string;grantedAt:string|null};
type SuppressionRow={guestId:string};
type RateRow={unitCostMinor:number};

const fallbackRates={EMAIL:2,SMS:18,WHATSAPP:25} as const;

export async function POST(req:Request){
  try{
    const actor=await requirePermission("ANALYTICS_VIEW");
    if(!actor.organizationId)throw new Error("FORBIDDEN");
    await ensureMarketingRuntime();
    const input=schema.parse(await req.json());
    const organizationId=actor.organizationId;

    if(input.eventId){
      const event=await db.event.findFirst({where:{id:input.eventId,organizationId},select:{id:true}});
      if(!event)throw new Error("Мероприятие не найдено");
    }

    const orders=await db.order.findMany({
      where:{status:"PAID",guestId:{not:null},event:{organizationId,...(input.eventId?{id:input.eventId}:{})}},
      select:{guestId:true,customerEmail:true,customerPhone:true,customerCity:true,createdAt:true},
    });

    const audience=new Map<string,{guestId:string;email:string;phone:string;city:string|null;orders:number}>();
    for(const order of orders){
      if(!order.guestId)continue;
      const previous=audience.get(order.guestId);
      audience.set(order.guestId,{guestId:order.guestId,email:previous?.email||order.customerEmail,phone:previous?.phone||order.customerPhone,city:previous?.city??order.customerCity,orders:(previous?.orders??0)+1});
    }

    const segmented=[...audience.values()].filter(customer=>(!input.segment.city||customer.city===input.segment.city)&&customer.orders>=input.segment.minOrders);
    const candidateIds=segmented.map(customer=>customer.guestId);
    const placeholders=candidateIds.map(()=>"?").join(",");

    const consents=candidateIds.length?await db.$queryRawUnsafe<ConsentRow[]>(`SELECT guestId,source,grantedAt FROM MarketingConsent WHERE organizationId=? AND channel=? AND purpose='MARKETING' AND status='GRANTED' AND guestId IN (${placeholders})`,organizationId,input.channel,...candidateIds):[];
    const suppressions=candidateIds.length?await db.$queryRawUnsafe<SuppressionRow[]>(`SELECT DISTINCT guestId FROM MarketingSuppression WHERE organizationId=? AND releasedAt IS NULL AND (channel IS NULL OR channel=?) AND guestId IN (${placeholders})`,organizationId,input.channel,...candidateIds):[];
    const consentMap=new Map(consents.map(row=>[row.guestId,row]));
    const suppressed=new Set(suppressions.map(row=>row.guestId));

    const rateRows=await db.$queryRawUnsafe<RateRow[]>(`SELECT providerCostMinor+atlasMarkupMinor AS unitCostMinor FROM CommunicationRate WHERE channel=? AND (organizationId=? OR organizationId IS NULL) AND activeFrom<=CURRENT_TIMESTAMP AND (activeTo IS NULL OR activeTo>CURRENT_TIMESTAMP) ORDER BY CASE WHEN organizationId=? THEN 0 ELSE 1 END, activeFrom DESC LIMIT 1`,input.channel,organizationId,organizationId);
    const unitCostMinor=Number(rateRows[0]?.unitCostMinor??fallbackRates[input.channel]);

    const eligible=segmented.flatMap(customer=>{
      const consent=consentMap.get(customer.guestId);
      const contactValue=input.channel==="EMAIL"?customer.email:customer.phone;
      if(!consent||suppressed.has(customer.guestId)||!contactValue)return [];
      return [{...customer,contactValue,consent}];
    });
    const campaignId=crypto.randomUUID();
    const costMinor=eligible.length*unitCostMinor;

    await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe(`INSERT INTO MarketingCampaign (id,organizationId,name,type,status,channel,segmentJson,contentJson,estimatedRecipients,estimatedCostMinor,reservedCostMinor,createdById,createdAt,updatedAt) VALUES (?, ?, ?, 'MARKETING', 'DRAFT', ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,campaignId,organizationId,input.name,input.channel,JSON.stringify({...input.segment,eventId:input.eventId??null,serverCalculated:true,candidateCount:segmented.length}),JSON.stringify({message:input.message}),eligible.length,costMinor,actor.id);
      for(const recipient of eligible){
        await tx.$executeRawUnsafe(`INSERT INTO MarketingCampaignRecipient (id,campaignId,guestId,channel,contactValue,status,exclusionReason,consentSource,consentGrantedAt,unitCostMinor,createdAt) VALUES (?, ?, ?, ?, ?, 'SNAPSHOT', NULL, ?, ?, ?, CURRENT_TIMESTAMP)`,crypto.randomUUID(),campaignId,recipient.guestId,input.channel,recipient.contactValue,recipient.consent.source,recipient.consent.grantedAt,unitCostMinor);
      }
    });

    await writeAudit(actor,{action:"MARKETING_CAMPAIGN_DRAFT_CREATE",entityType:"MarketingCampaign",entityId:campaignId,summary:`Создан черновик ${input.name}: ${eligible.length} проверенных получателей, ${(costMinor/100).toFixed(2)} ILS`});
    return NextResponse.json({ok:true,id:campaignId,serverEstimate:{candidates:segmented.length,recipients:eligible.length,excluded:segmented.length-eligible.length,unitCostMinor,costMinor}},{status:201});
  }catch(error){
    const message=error instanceof Error?error.message:"Ошибка";
    return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});
  }
}
