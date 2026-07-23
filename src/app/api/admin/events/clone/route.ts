import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";

const schema=z.object({sourceEventId:z.string().min(1),title:z.string().min(3),slug:z.string().regex(/^[a-z0-9-]+$/),startsAt:z.string().datetime(),doorsOpenAt:z.string().datetime(),salesStart:z.string().datetime(),salesEnd:z.string().datetime(),venueName:z.string().min(2),city:z.string().min(2),address:z.string().min(4),copyGuestLists:z.boolean().default(true),copyPromoters:z.boolean().default(true)});
function newCode(base:string){return `${base.replace(/[^A-Za-z0-9_-]/g,"-").slice(0,24)}-${randomBytes(3).toString("hex")}`.toUpperCase();}
function replaceDoors(description:string,doorsOpenAt:string){const marker=`<!--ATLAS_DOORS_OPEN:${doorsOpenAt}-->`;return description.match(/<!--ATLAS_DOORS_OPEN:[^>]+-->/)?description.replace(/<!--ATLAS_DOORS_OPEN:[^>]+-->/,marker):`${description}\n${marker}`;}

export async function POST(req:Request){
  try{
    const input=schema.parse(await req.json());const actor=await requirePermission("EVENT_MANAGE");if(!actor.organizationId)throw new Error("Организация не настроена");
    const source=await db.event.findFirst({where:{id:input.sourceEventId,organizationId:actor.organizationId},include:{categories:{include:{priceTiers:true}},zones:{include:{tables:{include:{seatItems:true}}}},ticketTemplate:true,promoterLinks:{include:{promoter:true}},venue:true}});if(!source)throw new Error("Исходное мероприятие не найдено");
    const result=await db.$transaction(async tx=>{
      const event=await tx.event.create({data:{title:input.title,slug:input.slug,description:replaceDoors(source.description,input.doorsOpenAt),posterUrl:source.posterUrl,startsAt:new Date(input.startsAt),salesStart:new Date(input.salesStart),salesEnd:new Date(input.salesEnd),status:"DRAFT",salesMode:source.salesMode,approvalInstructions:source.approvalInstructions,mapEnabled:source.mapEnabled,mapName:source.mapName,organization:{connect:{id:actor.organizationId!}},venue:{create:{name:input.venueName,city:input.city,address:input.address}}}});
      const categoryMap=new Map<string,string>();
      for(const category of source.categories){const created=await tx.ticketCategory.create({data:{eventId:event.id,name:category.name,description:category.description,priceMinor:category.priceMinor,pricingMode:category.pricingMode,currency:category.currency,capacity:category.capacity,sold:0,salesStart:new Date(input.salesStart),salesEnd:new Date(input.salesEnd),minPerOrder:category.minPerOrder,maxPerOrder:category.maxPerOrder,hidden:category.hidden,colorHex:category.colorHex}});categoryMap.set(category.id,created.id);for(const tier of category.priceTiers)await tx.ticketPriceTier.create({data:{categoryId:created.id,label:tier.label,priceMinor:tier.priceMinor,startsAt:new Date(input.salesStart),endsAt:new Date(input.salesEnd)}});}
      const tableMap=new Map<string,string>();
      for(const zone of source.zones){const newZone=await tx.zone.create({data:{eventId:event.id,name:zone.name}});for(const table of zone.tables){const newTable=await tx.table.create({data:{zoneId:newZone.id,label:table.label,seats:table.seats,priceMinor:table.priceMinor,priceMode:table.priceMode,objectType:table.objectType,x:table.x,y:table.y,rotation:table.rotation,width:table.width,height:table.height,reserved:false,categoryId:table.categoryId?categoryMap.get(table.categoryId):null}});tableMap.set(table.id,newTable.id);for(const seat of table.seatItems)await tx.seat.create({data:{tableId:newTable.id,label:seat.label,position:seat.position,status:"AVAILABLE",categoryId:seat.categoryId?categoryMap.get(seat.categoryId):null}});}}
      if(source.ticketTemplate)await tx.ticketTemplate.create({data:{eventId:event.id,name:source.ticketTemplate.name,canvasJson:source.ticketTemplate.canvasJson,backgroundColor:source.ticketTemplate.backgroundColor,accentColor:source.ticketTemplate.accentColor,textColor:source.ticketTemplate.textColor,logoUrl:source.ticketTemplate.logoUrl,backgroundUrl:source.ticketTemplate.backgroundUrl}});
      for(const link of source.promoterLinks){const isGuest=link.promoter.name.startsWith("__GUEST_LIST__:");if((isGuest&&!input.copyGuestLists)||(!isGuest&&!input.copyPromoters))continue;let promoterId=link.promoterId;if(isGuest){const promoter=await tx.promoter.create({data:{organizationId:actor.organizationId!,name:`__GUEST_LIST__:${link.label}:${randomBytes(4).toString("hex")}`,active:true,defaultCommissionBps:0}});promoterId=promoter.id;}await tx.promoterLink.create({data:{eventId:event.id,promoterId,label:link.label,code:newCode(link.label),active:link.active,allocationType:link.allocationType,guestLimit:link.guestLimit,maxPerOrder:link.maxPerOrder,customPriceMinor:link.customPriceMinor,commissionBps:link.commissionBps,exclusive:link.exclusive,categoryId:link.categoryId?categoryMap.get(link.categoryId):null,tableId:link.tableId?tableMap.get(link.tableId):null}});}
      return event;
    });
    await writeAudit(actor,{action:"EVENT_CLONED",entityType:"Event",entityId:result.id,summary:`Скопировано мероприятие ${source.title} → ${result.title}`});return NextResponse.json({id:result.id},{status:201});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Ошибка копирования"},{status:400});}
}
