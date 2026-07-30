import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureMarketingRuntime } from "@/lib/marketing-runtime";
import { writeAudit } from "@/lib/audit";

const allowedVariables=["{{first_name}}","{{event_name}}","{{event_date}}","{{venue}}","{{order_number}}","{{ticket_link}}","{{unsubscribe_link}}"] as const;
const createSchema=z.object({
  name:z.string().min(2).max(160),
  channel:z.enum(["EMAIL","SMS","WHATSAPP"]),
  eventId:z.string().nullable().optional(),
  subject:z.string().max(200).nullable().optional(),
  message:z.string().min(3).max(5000),
  templateId:z.string().max(80).nullable().optional(),
  variablesUsed:z.array(z.enum(allowedVariables)).max(allowedVariables.length).optional(),
  deliveryMode:z.enum(["DRAFT","SCHEDULED"]).default("DRAFT"),
  scheduledAt:z.string().datetime().nullable().optional(),
  segment:z.object({
    city:z.string().nullable().optional(),
    minOrders:z.number().int().min(1).max(1000),
    minSpendMinor:z.number().int().min(0).max(1000000000).optional(),
    purchasedAfter:z.string().nullable().optional(),
    purchasedBefore:z.string().nullable().optional(),
  }),
  estimatedRecipients:z.number().int().min(0).optional(),
  estimatedCostMinor:z.number().int().min(0).optional(),
}).superRefine((value,ctx)=>{
  if(value.channel==="EMAIL"&&(!value.subject||value.subject.trim().length<2))ctx.addIssue({code:"custom",path:["subject"],message:"Для Email требуется тема письма"});
  if(!value.message.includes("{{unsubscribe_link}}"))ctx.addIssue({code:"custom",path:["message"],message:"В рекламном сообщении должна быть ссылка для отписки {{unsubscribe_link}}"});
  if(value.segment.purchasedAfter&&Number.isNaN(Date.parse(value.segment.purchasedAfter)))ctx.addIssue({code:"custom",path:["segment","purchasedAfter"],message:"Некорректная дата начала периода"});
  if(value.segment.purchasedBefore&&Number.isNaN(Date.parse(value.segment.purchasedBefore)))ctx.addIssue({code:"custom",path:["segment","purchasedBefore"],message:"Некорректная дата конца периода"});
  if(value.deliveryMode==="SCHEDULED"){
    if(!value.scheduledAt)ctx.addIssue({code:"custom",path:["scheduledAt"],message:"Укажите дату и время отправки"});
    else{
      const time=new Date(value.scheduledAt).getTime();
      if(time<Date.now()+10*60*1000)ctx.addIssue({code:"custom",path:["scheduledAt"],message:"Кампанию можно запланировать минимум за 10 минут"});
      if(time>Date.now()+366*24*60*60*1000)ctx.addIssue({code:"custom",path:["scheduledAt"],message:"Нельзя планировать кампанию более чем на год вперёд"});
    }
  }
});

const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("duplicate"),campaignId:z.string().min(1)}),
  z.object({action:z.literal("archive"),campaignId:z.string().min(1)}),
  z.object({action:z.literal("rename"),campaignId:z.string().min(1),name:z.string().min(2).max(160)}),
]);

type ConsentRow={guestId:string;source:string;grantedAt:string|null};
type SuppressionRow={guestId:string};
type RateRow={unitCostMinor:number};
type ExistingCampaign={id:string;name:string;channel:string;status:string;segmentJson:string;contentJson:string;estimatedRecipients:number;estimatedCostMinor:number;reservedCostMinor:number};
const fallbackRates={EMAIL:2,SMS:18,WHATSAPP:25} as const;

export async function POST(req:Request){
  try{
    const actor=await requirePermission("ANALYTICS_VIEW");
    if(!actor.organizationId)throw new Error("FORBIDDEN");
    await ensureMarketingRuntime();
    const input=createSchema.parse(await req.json());
    const organizationId=actor.organizationId;
    if(input.eventId){const event=await db.event.findFirst({where:{id:input.eventId,organizationId},select:{id:true}});if(!event)throw new Error("Мероприятие не найдено");}
    const orders=await db.order.findMany({where:{status:"PAID",guestId:{not:null},event:{organizationId,...(input.eventId?{id:input.eventId}:{})}},select:{guestId:true,customerEmail:true,customerPhone:true,customerCity:true,totalMinor:true,createdAt:true}});
    const audience=new Map<string,{guestId:string;email:string;phone:string;city:string|null;orders:number;totalMinor:number;lastPurchaseAt:Date}>();
    for(const order of orders){if(!order.guestId)continue;const previous=audience.get(order.guestId);audience.set(order.guestId,{guestId:order.guestId,email:previous?.email||order.customerEmail,phone:previous?.phone||order.customerPhone,city:previous?.city??order.customerCity,orders:(previous?.orders??0)+1,totalMinor:(previous?.totalMinor??0)+order.totalMinor,lastPurchaseAt:previous&&previous.lastPurchaseAt>order.createdAt?previous.lastPurchaseAt:order.createdAt});}
    const after=input.segment.purchasedAfter?new Date(`${input.segment.purchasedAfter}T00:00:00`):null;
    const before=input.segment.purchasedBefore?new Date(`${input.segment.purchasedBefore}T23:59:59`):null;
    const segmented=[...audience.values()].filter(customer=>(!input.segment.city||customer.city===input.segment.city)&&customer.orders>=input.segment.minOrders&&customer.totalMinor>=(input.segment.minSpendMinor??0)&&(!after||customer.lastPurchaseAt>=after)&&(!before||customer.lastPurchaseAt<=before));
    const candidateIds=segmented.map(customer=>customer.guestId);const placeholders=candidateIds.map(()=>"?").join(",");
    const consents=candidateIds.length?await db.$queryRawUnsafe<ConsentRow[]>(`SELECT guestId,source,grantedAt FROM MarketingConsent WHERE organizationId=? AND channel=? AND purpose='MARKETING' AND status='GRANTED' AND guestId IN (${placeholders})`,organizationId,input.channel,...candidateIds):[];
    const suppressions=candidateIds.length?await db.$queryRawUnsafe<SuppressionRow[]>(`SELECT DISTINCT guestId FROM MarketingSuppression WHERE organizationId=? AND releasedAt IS NULL AND (channel IS NULL OR channel=?) AND guestId IN (${placeholders})`,organizationId,input.channel,...candidateIds):[];
    const consentMap=new Map(consents.map(row=>[row.guestId,row]));const suppressed=new Set(suppressions.map(row=>row.guestId));
    const rateRows=await db.$queryRawUnsafe<RateRow[]>(`SELECT providerCostMinor+atlasMarkupMinor AS unitCostMinor FROM CommunicationRate WHERE channel=? AND (organizationId=? OR organizationId IS NULL) AND activeFrom<=CURRENT_TIMESTAMP AND (activeTo IS NULL OR activeTo>CURRENT_TIMESTAMP) ORDER BY CASE WHEN organizationId=? THEN 0 ELSE 1 END, activeFrom DESC LIMIT 1`,input.channel,organizationId,organizationId);
    const unitCostMinor=Number(rateRows[0]?.unitCostMinor??fallbackRates[input.channel]);
    const eligible=segmented.flatMap(customer=>{const consent=consentMap.get(customer.guestId);const contactValue=input.channel==="EMAIL"?customer.email:customer.phone;if(!consent||suppressed.has(customer.guestId)||!contactValue)return [];return [{...customer,contactValue,consent}];});
    if(input.deliveryMode==="SCHEDULED"&&eligible.length===0)throw new Error("Нельзя запланировать кампанию без проверенных получателей");
    const campaignId=crypto.randomUUID();const costMinor=eligible.length*unitCostMinor;const status=input.deliveryMode==="SCHEDULED"?"SCHEDULED":"DRAFT";const scheduledAt=input.deliveryMode==="SCHEDULED"?input.scheduledAt:null;
    const contentJson=JSON.stringify({subject:input.channel==="EMAIL"?input.subject:null,message:input.message,templateId:input.templateId??null,variablesUsed:input.variablesUsed??[],contentVersion:1});
    const segmentJson=JSON.stringify({...input.segment,eventId:input.eventId??null,serverCalculated:true,candidateCount:segmented.length});
    await db.$transaction(async tx=>{await tx.$executeRawUnsafe(`INSERT INTO MarketingCampaign (id,organizationId,name,type,status,channel,segmentJson,contentJson,estimatedRecipients,estimatedCostMinor,reservedCostMinor,scheduledAt,createdById,createdAt,updatedAt) VALUES (?, ?, ?, 'MARKETING', ?, ?, ?, ?, ?, ?, 0, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,campaignId,organizationId,input.name,status,input.channel,segmentJson,contentJson,eligible.length,costMinor,scheduledAt,actor.id);for(const recipient of eligible){await tx.$executeRawUnsafe(`INSERT INTO MarketingCampaignRecipient (id,campaignId,guestId,channel,contactValue,status,exclusionReason,consentSource,consentGrantedAt,unitCostMinor,createdAt) VALUES (?, ?, ?, ?, ?, 'SNAPSHOT', NULL, ?, ?, ?, CURRENT_TIMESTAMP)`,crypto.randomUUID(),campaignId,recipient.guestId,input.channel,recipient.contactValue,recipient.consent.source,recipient.consent.grantedAt,unitCostMinor);}});
    await writeAudit(actor,{action:status==="SCHEDULED"?"MARKETING_CAMPAIGN_SCHEDULE":"MARKETING_CAMPAIGN_DRAFT_CREATE",entityType:"MarketingCampaign",entityId:campaignId,summary:status==="SCHEDULED"?`Запланирована кампания ${input.name}: ${eligible.length} получателей, ${(costMinor/100).toFixed(2)} ILS, ${scheduledAt}`:`Создан черновик ${input.name}: ${eligible.length} проверенных получателей, ${(costMinor/100).toFixed(2)} ILS`});
    return NextResponse.json({ok:true,id:campaignId,status,scheduledAt,serverEstimate:{candidates:segmented.length,recipients:eligible.length,excluded:segmented.length-eligible.length,unitCostMinor,costMinor}},{status:201});
  }catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});}
}

export async function PATCH(req:Request){
  try{
    const actor=await requirePermission("ANALYTICS_VIEW");
    if(!actor.organizationId)throw new Error("FORBIDDEN");
    await ensureMarketingRuntime();
    const input=actionSchema.parse(await req.json());
    const rows=await db.$queryRawUnsafe<ExistingCampaign[]>(`SELECT id,name,channel,status,segmentJson,contentJson,estimatedRecipients,estimatedCostMinor,reservedCostMinor FROM MarketingCampaign WHERE id=? AND organizationId=? LIMIT 1`,input.campaignId,actor.organizationId);
    const campaign=rows[0];if(!campaign)throw new Error("Кампания не найдена");
    if(input.action==="archive"){
      if(["SENDING","COMPLETED"].includes(campaign.status))throw new Error("Нельзя архивировать активную или завершённую отправку");
      await db.$executeRawUnsafe(`UPDATE MarketingCampaign SET status='ARCHIVED',scheduledAt=NULL,updatedAt=CURRENT_TIMESTAMP WHERE id=? AND organizationId=?`,campaign.id,actor.organizationId);
      await writeAudit(actor,{action:"MARKETING_CAMPAIGN_ARCHIVE",entityType:"MarketingCampaign",entityId:campaign.id,summary:`Кампания ${campaign.name} отправлена в архив`});
      return NextResponse.json({ok:true});
    }
    if(input.action==="rename"){
      await db.$executeRawUnsafe(`UPDATE MarketingCampaign SET name=?,updatedAt=CURRENT_TIMESTAMP WHERE id=? AND organizationId=?`,input.name,campaign.id,actor.organizationId);
      await writeAudit(actor,{action:"MARKETING_CAMPAIGN_RENAME",entityType:"MarketingCampaign",entityId:campaign.id,summary:`Кампания переименована в ${input.name}`});
      return NextResponse.json({ok:true});
    }
    const newId=crypto.randomUUID();
    await db.$transaction(async tx=>{
      await tx.$executeRawUnsafe(`INSERT INTO MarketingCampaign (id,organizationId,name,type,status,channel,segmentJson,contentJson,estimatedRecipients,estimatedCostMinor,reservedCostMinor,scheduledAt,createdById,createdAt,updatedAt) VALUES (?, ?, ?, 'MARKETING', 'DRAFT', ?, ?, ?, ?, ?, 0, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,newId,actor.organizationId,`${campaign.name} - копия`,campaign.channel,campaign.segmentJson,campaign.contentJson,campaign.estimatedRecipients,campaign.estimatedCostMinor,actor.id);
      await tx.$executeRawUnsafe(`INSERT INTO MarketingCampaignRecipient (id,campaignId,guestId,channel,contactValue,status,exclusionReason,consentSource,consentGrantedAt,unitCostMinor,createdAt) SELECT lower(hex(randomblob(16))), ?, guestId,channel,contactValue,'SNAPSHOT',exclusionReason,consentSource,consentGrantedAt,unitCostMinor,CURRENT_TIMESTAMP FROM MarketingCampaignRecipient WHERE campaignId=?`,newId,campaign.id);
    });
    await writeAudit(actor,{action:"MARKETING_CAMPAIGN_DUPLICATE",entityType:"MarketingCampaign",entityId:newId,summary:`Создана копия кампании ${campaign.name}`});
    return NextResponse.json({ok:true,id:newId},{status:201});
  }catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400});}
}
