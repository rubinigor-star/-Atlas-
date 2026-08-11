import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission, requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { assignPromoterToEvent, sendPromoterLinkEmail, setPromoterAutomation } from "@/lib/promoter-workflow";

const promoterSchema = z.object({ action:z.literal("promoter"), name:z.string().trim().min(2).max(120), email:z.string().email(), phone:z.string().max(40).optional(), commissionPercent:z.number().min(0).max(100).default(0), autoAssignAllEvents:z.boolean().default(false) });
const automationSchema=z.object({action:z.literal("automation"),promoterId:z.string().min(1),autoAssignAllEvents:z.boolean()});
const assignSchema=z.object({action:z.literal("assignEvent"),promoterId:z.string().min(1),eventId:z.string().min(1)});
const resendSchema=z.object({action:z.literal("resendEmail"),linkId:z.string().min(1)});
const linkFields=z.object({eventId:z.string().min(1),promoterId:z.string().min(1),label:z.string().min(2).max(120),allocationType:z.enum(["EVENT","CATEGORY","TABLE"]),categoryId:z.string().optional().nullable(),tableId:z.string().optional().nullable(),guestLimit:z.number().int().positive().optional().nullable(),maxPerOrder:z.number().int().min(1).max(50).default(10),customPriceMinor:z.number().int().positive().optional().nullable(),commissionPercent:z.number().min(0).max(100).default(0),exclusive:z.boolean().default(true),startsAt:z.string().datetime().optional().nullable(),endsAt:z.string().datetime().optional().nullable()});
const editLinkSchema=linkFields.extend({action:z.literal("editLink"),linkId:z.string().min(1)});
const toggleSchema=z.object({action:z.literal("toggle"),linkId:z.string().min(1),active:z.boolean()});
const archivePromoterSchema=z.object({action:z.literal("archivePromoter"),promoterId:z.string().min(1),active:z.boolean().default(false)});

type Actor=Awaited<ReturnType<typeof requirePermission>>;

async function loadAuthorizedPromoter(promoterId:string,actor:Actor,{requireActive=false}:{requireActive?:boolean}={}){
 const promoter=await db.promoter.findUnique({where:{id:promoterId}});
 if(!promoter||promoter.name.startsWith("__"))throw new Error("PROMOTER_NOT_FOUND");
 if(actor.role!=="ADMIN"&&(!actor.organizationId||actor.organizationId!==promoter.organizationId))throw new Error("FORBIDDEN");
 if(requireActive&&!promoter.active)throw new Error("PROMOTER_ARCHIVED");
 return promoter;
}

async function validateAllocation(input:z.infer<typeof linkFields>){
 if(input.allocationType==="CATEGORY"){const category=await db.ticketCategory.findFirst({where:{id:input.categoryId||"",eventId:input.eventId}});if(!category)throw new Error("Категория не относится к мероприятию");}
 if(input.allocationType==="TABLE"){const table=await db.table.findFirst({where:{id:input.tableId||"",zone:{eventId:input.eventId}}});if(!table)throw new Error("Стол не относится к мероприятию");}
 if(input.startsAt&&input.endsAt&&new Date(input.startsAt)>=new Date(input.endsAt))throw new Error("Дата окончания должна быть позже даты начала");
}

function publicError(error:unknown){
 const message=error instanceof Error?error.message:"Ошибка";
 if(message==="FORBIDDEN")return{message:"Недостаточно прав",status:403};
 if(message==="PROMOTER_NOT_FOUND")return{message:"Промоутер не найден. Обновите список промоутеров и откройте его заново.",status:404};
 if(message==="PROMOTER_ARCHIVED")return{message:"Промоутер архивирован. Сначала восстановите его.",status:409};
 return{message,status:400};
}

export async function POST(req:Request){
 try{
  const body=await req.json();
  if(body.action==="promoter"){
   const input=promoterSchema.parse(body);const actor=await requirePermission("EVENT_MANAGE");if(!actor.organizationId)throw new Error("FORBIDDEN");
   const existing=await db.promoter.findFirst({where:{organizationId:actor.organizationId,name:input.name,NOT:{name:{startsWith:"__"}}},select:{id:true,name:true}});
   if(existing)return NextResponse.json({error:`Промоутер «${existing.name}» уже существует.`,existingId:existing.id},{status:409});
   const promoter=await db.promoter.create({data:{organizationId:actor.organizationId,name:input.name,email:input.email,phone:input.phone||null,defaultCommissionBps:Math.round(input.commissionPercent*100),active:true}});
   await setPromoterAutomation(promoter.id,input.autoAssignAllEvents);
   await writeAudit(actor,{action:"PROMOTER_CREATE",entityType:"Promoter",entityId:promoter.id,summary:`Создан промоутер ${promoter.name}`});
   return NextResponse.json({ok:true,id:promoter.id},{status:201});
  }
  if(body.action==="automation"){
   const input=automationSchema.parse(body);const actor=await requirePermission("EVENT_MANAGE");const promoter=await loadAuthorizedPromoter(input.promoterId,actor,{requireActive:true});
   await setPromoterAutomation(promoter.id,input.autoAssignAllEvents);
   await writeAudit(actor,{action:"PROMOTER_AUTOMATION_UPDATE",entityType:"Promoter",entityId:promoter.id,summary:input.autoAssignAllEvents?`Промоутер ${promoter.name} будет добавляться ко всем новым мероприятиям`:`Автодобавление промоутера ${promoter.name} отключено`});
   return NextResponse.json({ok:true,autoAssignAllEvents:input.autoAssignAllEvents});
  }
  if(body.action==="assignEvent"){
   const input=assignSchema.parse(body);const actor=await requirePermission("EVENT_MANAGE");const promoter=await loadAuthorizedPromoter(input.promoterId,actor,{requireActive:true});
   const event=await db.event.findUnique({where:{id:input.eventId},select:{organizationId:true,status:true}});if(!event)throw new Error("Мероприятие не найдено");
   if(event.organizationId!==promoter.organizationId)throw new Error("Промоутер и мероприятие относятся к разным организациям");
   await requireEventAccess("EVENT_MANAGE",input.eventId);
   const link=await assignPromoterToEvent(promoter.id,input.eventId);
   let emailStatus="WAITING_FOR_PUBLISH";if(event.status==="PUBLISHED"){try{await sendPromoterLinkEmail(link.id);emailStatus="SENT"}catch{emailStatus="ERROR"}}
   await writeAudit(actor,{action:"PROMOTER_EVENT_ASSIGN",entityType:"PromoterLink",entityId:link.id,summary:`${promoter.name} назначен на мероприятие`});
   return NextResponse.json({ok:true,id:link.id,emailStatus},{status:201});
  }
  if(body.action==="resendEmail"){
   const input=resendSchema.parse(body);const link=await db.promoterLink.findUnique({where:{id:input.linkId},include:{promoter:true,event:true}});if(!link||link.promoter.name.startsWith("__"))throw new Error("Ссылка не найдена");
   const actor=await requirePermission("EVENT_MANAGE");await loadAuthorizedPromoter(link.promoterId,actor,{requireActive:true});if(link.promoter.organizationId!==link.event.organizationId)throw new Error("Некорректная связь промоутера и мероприятия");await requireEventAccess("EVENT_MANAGE",link.eventId);
   await sendPromoterLinkEmail(link.id,true);await writeAudit(actor,{action:"PROMOTER_LINK_EMAIL_RESEND",entityType:"PromoterLink",entityId:link.id,summary:`Повторно отправлена ссылка ${link.label}`});return NextResponse.json({ok:true});
  }
  if(body.action==="editLink"){
   const input=editLinkSchema.parse(body);const existing=await db.promoterLink.findUnique({where:{id:input.linkId},include:{promoter:true,event:true}});if(!existing)throw new Error("Ссылка не найдена");
   const actor=await requirePermission("EVENT_MANAGE");await loadAuthorizedPromoter(existing.promoterId,actor);if(existing.promoterId!==input.promoterId)throw new Error("FORBIDDEN");if(existing.eventId!==input.eventId)throw new Error("Мероприятие существующей ссылки менять нельзя.");await requireEventAccess("EVENT_MANAGE",existing.eventId);await validateAllocation(input);
   const link=await db.promoterLink.update({where:{id:input.linkId},data:{label:input.label,allocationType:input.allocationType,categoryId:input.allocationType==="CATEGORY"?input.categoryId:null,tableId:input.allocationType==="TABLE"?input.tableId:null,guestLimit:input.guestLimit??null,maxPerOrder:input.maxPerOrder,customPriceMinor:input.customPriceMinor??null,commissionBps:Math.round(input.commissionPercent*100),exclusive:input.exclusive,startsAt:input.startsAt?new Date(input.startsAt):null,endsAt:input.endsAt?new Date(input.endsAt):null}});
   await writeAudit(actor,{action:"PROMOTER_LINK_UPDATE",entityType:"PromoterLink",entityId:link.id,summary:`Обновлена ссылка ${link.label}`});return NextResponse.json({ok:true,id:link.id});
  }
  if(body.action==="toggle"){
   const input=toggleSchema.parse(body);const existing=await db.promoterLink.findUnique({where:{id:input.linkId},select:{eventId:true,promoterId:true}});if(!existing)throw new Error("Ссылка не найдена");const actor=await requirePermission("EVENT_MANAGE");await loadAuthorizedPromoter(existing.promoterId,actor);await requireEventAccess("EVENT_MANAGE",existing.eventId);
   await db.promoterLink.update({where:{id:input.linkId},data:{active:input.active}});await writeAudit(actor,{action:input.active?"PROMOTER_LINK_ENABLE":"PROMOTER_LINK_DISABLE",entityType:"PromoterLink",entityId:input.linkId,summary:input.active?"Ссылка включена":"Ссылка отключена"});return NextResponse.json({ok:true});
  }
  if(body.action==="archivePromoter"){
   const input=archivePromoterSchema.parse(body);const actor=await requirePermission("EVENT_MANAGE");const promoter=await loadAuthorizedPromoter(input.promoterId,actor);
   await db.$transaction([db.promoter.update({where:{id:promoter.id},data:{active:input.active}}),...(input.active?[]:[db.promoterLink.updateMany({where:{promoterId:promoter.id,active:true},data:{active:false}})])]);
   await writeAudit(actor,{action:input.active?"PROMOTER_RESTORE":"PROMOTER_ARCHIVE",entityType:"Promoter",entityId:promoter.id,summary:input.active?`Восстановлен промоутер ${promoter.name}`:`Архивирован промоутер ${promoter.name}`});return NextResponse.json({ok:true});
  }
  throw new Error("Unknown action");
 }catch(error){const output=publicError(error);console.error("[promoters-api]",error);return NextResponse.json({error:output.message},{status:output.status})}
}
