import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { guestManagementToken } from "@/lib/guest-links";

const schema=z.object({eventId:z.string().min(1),displayName:z.string().min(2).max(120),kind:z.enum(["GUEST","SALES"]),allocationType:z.enum(["EVENT","CATEGORY","TABLE"]),categoryId:z.string().optional().nullable(),tableId:z.string().optional().nullable(),priceMode:z.enum(["FULL","FREE","CUSTOM"]),customPriceMinor:z.number().int().min(0).optional().nullable(),guestLimit:z.number().int().min(1).max(10000).optional().nullable(),maxPerOrder:z.number().int().min(1).max(100),startsAt:z.string().optional().nullable(),endsAt:z.string().optional().nullable(),code:z.string().regex(/^[A-Za-z0-9_-]{3,40}$/).optional()});

export async function POST(req:Request){
 try{
  const input=schema.parse(await req.json());const actor=await requireEventAccess("EVENT_MANAGE",input.eventId);
  const event=await db.event.findUnique({where:{id:input.eventId},include:{categories:true,zones:{include:{tables:true}}}});if(!event)throw new Error("Мероприятие не найдено");
  const category=input.allocationType==="CATEGORY"?event.categories.find(x=>x.id===input.categoryId):null;
  const table=input.allocationType==="TABLE"?event.zones.flatMap(z=>z.tables).find(x=>x.id===input.tableId):null;
  if(input.allocationType==="CATEGORY"&&!category)throw new Error("Билет не относится к мероприятию");
  if(input.allocationType==="TABLE"&&!table)throw new Error("Стол не относится к мероприятию");
  if(input.kind==="GUEST"&&!input.guestLimit)throw new Error("Укажите лимит приглашённых");
  if(table&&input.guestLimit&&input.guestLimit>table.seats)throw new Error(`У этого стола только ${table.seats} мест`);
  if(input.priceMode==="CUSTOM"&&input.customPriceMinor==null)throw new Error("Укажите специальную цену");
  const raw=input.code?.toUpperCase()||`${input.displayName.replace(/[^A-Za-zА-Яа-я0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,20)}-${randomBytes(3).toString("hex")}`.toUpperCase();const code=raw.replace(/[^A-Z0-9_-]/g,"-");
  const customPriceMinor=input.kind==="GUEST"||input.priceMode==="FREE"?0:input.priceMode==="CUSTOM"?input.customPriceMinor:null;
  const result=await db.$transaction(async tx=>{const promoter=await tx.promoter.create({data:{organizationId:actor.organizationId!,name:`__CHANNEL__:${input.kind}:${input.displayName}:${randomBytes(4).toString("hex")}`,active:true,defaultCommissionBps:0}});return tx.promoterLink.create({data:{eventId:input.eventId,promoterId:promoter.id,label:input.displayName,code,allocationType:input.allocationType,categoryId:input.allocationType==="CATEGORY"?input.categoryId:null,tableId:input.allocationType==="TABLE"?input.tableId:null,guestLimit:input.guestLimit,maxPerOrder:input.maxPerOrder,customPriceMinor,commissionBps:0,exclusive:true,startsAt:input.startsAt?new Date(input.startsAt):null,endsAt:input.endsAt?new Date(input.endsAt):null}})});
  await writeAudit(actor,{action:"SALES_CHANNEL_CREATE",entityType:"PromoterLink",entityId:result.id,summary:`Создан канал ${input.displayName}`});
  const isGuest=input.kind==="GUEST";return NextResponse.json({ok:true,code:result.code,publicPath:isGuest?`/g/${result.code}`:`/events/${event.slug}?channel=${result.code}`,managePath:isGuest?`/g/${result.code}?token=${guestManagementToken(result.id)}`:null},{status:201});
 }catch(error){const message=error instanceof Error?error.message:"Ошибка";return NextResponse.json({error:message==="FORBIDDEN"?"Недостаточно прав":message},{status:message==="FORBIDDEN"?403:400})}
}
