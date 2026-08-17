import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { guestManagementToken, isGuestListPromoter, setGuestLinkSettings } from "@/lib/guest-links";

const createSchema=z.object({action:z.literal("create").optional(),eventId:z.string().min(1),displayName:z.string().min(2).max(120),allocationType:z.enum(["EVENT","CATEGORY","TABLE","SEATS"]),seatIds:z.array(z.string().min(1)).max(500).optional(),categoryId:z.string().optional().nullable(),tableId:z.string().optional().nullable(),priceMode:z.enum(["FULL","FREE","CUSTOM"]),customPriceMinor:z.number().int().min(0).optional().nullable(),guestLimit:z.number().int().min(1).max(10000),maxPerOrder:z.number().int().min(1).max(100),showAttendees:z.boolean().optional().default(false),startsAt:z.string().optional().nullable(),endsAt:z.string().optional().nullable(),code:z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).optional()});
const toggleSchema=z.object({action:z.literal("toggle"),linkId:z.string().min(1),active:z.boolean()});
const updateSchema=z.object({action:z.literal("update"),linkId:z.string().min(1),displayName:z.string().min(2).max(120),guestLimit:z.number().int().min(1).max(10000),maxPerOrder:z.number().int().min(1).max(100),showAttendees:z.boolean(),startsAt:z.string().optional().nullable(),endsAt:z.string().optional().nullable()});
const deleteSchema=z.object({action:z.literal("delete"),linkId:z.string().min(1)});

async function guestLinkOrThrow(linkId:string){
 const link=await db.promoterLink.findUnique({where:{id:linkId},include:{promoter:true,table:true}});
 if(!link||!isGuestListPromoter(link.promoter.name))throw new Error("Гостевая ссылка не найдена");
 return link;
}

export async function POST(req:Request){
 try{
  const body=await req.json();
  if(body.action==="toggle"){
   const input=toggleSchema.parse(body);const link=await guestLinkOrThrow(input.linkId);const actor=await requireEventAccess("EVENT_MANAGE",link.eventId);
   await db.promoterLink.update({where:{id:link.id},data:{active:input.active}});
   await writeAudit(actor,{action:input.active?"GUEST_LIST_ENABLE":"GUEST_LIST_DISABLE",entityType:"PromoterLink",entityId:link.id,summary:input.active?`Включена гостевая ссылка ${link.label}`:`Отключена гостевая ссылка ${link.label}`});
   return NextResponse.json({ok:true});
  }
  if(body.action==="update"){
   const input=updateSchema.parse(body);const link=await guestLinkOrThrow(input.linkId);const actor=await requireEventAccess("EVENT_MANAGE",link.eventId);
   if(input.startsAt&&input.endsAt&&new Date(input.startsAt)>=new Date(input.endsAt))throw new Error("Дата окончания должна быть позже даты начала");
   if(link.table&&input.guestLimit>link.table.seats)throw new Error(`У этого стола только ${link.table.seats} мест`);
   const used=await db.order.findMany({where:{promoterLinkId:link.id,status:{notIn:["CANCELLED","REJECTED"]}},select:{items:{select:{quantity:true}}}}).then(rows=>rows.flatMap(r=>r.items).reduce((s,i)=>s+i.quantity,0));
   if(input.guestLimit<used)throw new Error(`По ссылке уже зарегистрировано ${used}, лимит нельзя уменьшить ниже этого числа`);
   await db.promoterLink.update({where:{id:link.id},data:{label:input.displayName,guestLimit:input.guestLimit,maxPerOrder:input.maxPerOrder,startsAt:input.startsAt?new Date(input.startsAt):null,endsAt:input.endsAt?new Date(input.endsAt):null}});
   await setGuestLinkSettings(link.id,{showAttendees:input.showAttendees});
   await writeAudit(actor,{action:"GUEST_LIST_UPDATE",entityType:"PromoterLink",entityId:link.id,summary:`Обновлена гостевая ссылка ${input.displayName}`});
   return NextResponse.json({ok:true});
  }
  if(body.action==="delete"){
   const input=deleteSchema.parse(body);const link=await guestLinkOrThrow(input.linkId);const actor=await requireEventAccess("EVENT_MANAGE",link.eventId);
   const orderCount=await db.order.count({where:{promoterLinkId:link.id}});
   if(orderCount===0){
    await db.promoterLink.delete({where:{id:link.id}});
    const remaining=await db.promoterLink.count({where:{promoterId:link.promoterId}});
    if(remaining===0)await db.promoter.delete({where:{id:link.promoterId}}).catch(()=>undefined);
   }else{
    await db.promoterLink.update({where:{id:link.id},data:{active:false,label:`[Удалено] ${link.label}`}});
    await db.promoter.update({where:{id:link.promoterId},data:{active:false,name:`__DELETED_GUEST__:${link.id}`}});
   }
   await writeAudit(actor,{action:"GUEST_LIST_DELETE",entityType:"PromoterLink",entityId:link.id,summary:`Удалена гостевая ссылка ${link.label}`,metadata:{preservedForHistory:orderCount>0,orderCount}});
   return NextResponse.json({ok:true,preservedForHistory:orderCount>0});
  }

  const input=createSchema.parse(body);const actor=await requireEventAccess("EVENT_MANAGE",input.eventId);
  const event=await db.event.findUnique({where:{id:input.eventId},include:{categories:true,zones:{include:{tables:{include:{seatItems:true}}}}}});if(!event)throw new Error("Мероприятие не найдено");
  const category=input.allocationType==="CATEGORY"?event.categories.find(x=>x.id===input.categoryId):null;
  const table=input.allocationType==="TABLE"?event.zones.flatMap(z=>z.tables).find(x=>x.id===input.tableId):null;
  const requestedSeatIds=[...new Set(input.seatIds??[])];
  const allSeats=event.zones.flatMap(zone=>zone.tables.flatMap(tableItem=>tableItem.seatItems.map(seat=>({seat,table:tableItem}))));
  const selectedSeats=requestedSeatIds.map(id=>allSeats.find(item=>item.seat.id===id)).filter((item):item is NonNullable<typeof item>=>Boolean(item));
  if(input.allocationType==="CATEGORY"&&!category)throw new Error("Билет не относится к мероприятию");
  if(input.allocationType==="TABLE"&&!table)throw new Error("Стол не относится к мероприятию");
  if(input.allocationType==="SEATS"){
   if(!requestedSeatIds.length||selectedSeats.length!==requestedSeatIds.length)throw new Error("Выберите корректные места на карте");
   if(selectedSeats.some(item=>item.table.priceMode!=="PER_SEAT"))throw new Error("Одно из выбранных мест относится к объекту, который продаётся только целиком");
   if(selectedSeats.some(item=>item.seat.status!=="AVAILABLE"))throw new Error("Одно из выбранных мест уже недоступно");
   if(selectedSeats.some(item=>!(item.seat.categoryId??item.table.categoryId)))throw new Error("Для одного из выбранных мест не назначена категория билета");
   if(input.guestLimit!==requestedSeatIds.length)throw new Error("Лимит ссылки должен совпадать с количеством выбранных мест");
  }
  if(table&&input.guestLimit>table.seats)throw new Error(`У этого стола только ${table.seats} мест`);
  if(input.priceMode==="CUSTOM"&&input.customPriceMinor==null)throw new Error("Укажите специальную цену");
  if(input.startsAt&&input.endsAt&&new Date(input.startsAt)>=new Date(input.endsAt))throw new Error("Дата окончания должна быть позже даты начала");
  const raw=input.code?.toUpperCase()||`${input.displayName.replace(/[^A-Za-zА-Яа-я0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,20)}-${randomBytes(3).toString("hex")}`.toUpperCase();const code=raw.replace(/[^A-Z0-9_-]/g,"-");
  const customPriceMinor=input.priceMode==="FREE"?0:input.priceMode==="CUSTOM"?input.customPriceMinor:null;
  const storedAllocation=input.allocationType==="SEATS"?"EVENT":input.allocationType;
  const result=await db.$transaction(async tx=>{const promoter=await tx.promoter.create({data:{organizationId:actor.organizationId!,name:`__CHANNEL__:GUEST:${input.displayName}:${randomBytes(4).toString("hex")}`,active:true,defaultCommissionBps:0}});return tx.promoterLink.create({data:{eventId:input.eventId,promoterId:promoter.id,label:input.displayName,code,allocationType:storedAllocation,categoryId:input.allocationType==="CATEGORY"?input.categoryId:null,tableId:input.allocationType==="TABLE"?input.tableId:null,guestLimit:input.guestLimit,maxPerOrder:input.maxPerOrder,customPriceMinor,commissionBps:0,exclusive:true,startsAt:input.startsAt?new Date(input.startsAt):null,endsAt:input.endsAt?new Date(input.endsAt):null}})});
  await setGuestLinkSettings(result.id,{showAttendees:input.showAttendees,seatIds:input.allocationType==="SEATS"?requestedSeatIds:[]});
  await writeAudit(actor,{action:"GUEST_LIST_CREATE",entityType:"PromoterLink",entityId:result.id,summary:`Создана гостевая ссылка ${input.displayName}`});
  return NextResponse.json({ok:true,code:result.code,publicPath:`/g/${result.code}`,managePath:`/g/${result.code}?token=${guestManagementToken(result.id)}`},{status:201});
 }catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400})}
}
