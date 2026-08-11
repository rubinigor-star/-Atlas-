import { randomUUID } from "node:crypto";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isGuestListPromoter, verifyGuestManagementToken } from "@/lib/guest-links";
import { orderNumber, ticketCode } from "@/lib/ticketing";
import { guestFieldKeys, parseGuestFields } from "@/lib/event-guest-fields";
import { sendOrderTicketEmail } from "@/lib/order-email";
import { saveCustomerDemographics } from "@/lib/customer-demographics";

const addSchema=z.object({action:z.literal("add"),token:z.string().min(10),customer:z.record(z.string(),z.string().max(250))});
const removeSchema=z.object({action:z.literal("remove"),token:z.string().min(10),orderId:z.string().min(1)});
const visitSchema=z.object({action:z.literal("visit"),sessionId:z.string().min(8).max(100)});
function normalizePhone(value:string){const digits=value.replace(/\D/g,"");if(digits.startsWith("972"))return `+${digits}`;if(digits.startsWith("0"))return `+972${digits.slice(1)}`;return `+972${digits}`;}

export async function POST(req:Request,{params}:{params:Promise<{code:string}>}){
  try{
    const {code}=await params;const body=await req.json();
    const link=await db.promoterLink.findUnique({where:{code:code.toUpperCase()},include:{promoter:true,event:{include:{categories:true}},category:true,table:{include:{category:true}},orders:{where:{status:{notIn:["CANCELLED","REJECTED"]}},include:{items:true,tickets:true}}}});
    const now=new Date();
    if(!link||!link.active||!isGuestListPromoter(link.promoter.name)||(link.startsAt&&link.startsAt>now)||(link.endsAt&&link.endsAt<now))throw new Error("Гостевой список не найден или сейчас недоступен");
    if(body.action==="visit"){const input=visitSchema.parse(body);await db.promoterLinkVisit.upsert({where:{linkId_sessionId:{linkId:link.id,sessionId:input.sessionId}},update:{},create:{linkId:link.id,sessionId:input.sessionId,userAgent:req.headers.get("user-agent")}});return NextResponse.json({ok:true});}
    if(!verifyGuestManagementToken(link.id,String(body.token||"")))throw new Error("Ссылка управления недействительна");
    if(body.action==="add"){
      const input=addSchema.parse(body);const fields=parseGuestFields(link.event.description);const customer=input.customer;
      for(const key of guestFieldKeys)if(fields[key].visible&&fields[key].required&&!String(customer[key]||"").trim())throw new Error(`Заполните обязательное поле: ${key}`);
      const gender=z.enum(["MALE","FEMALE"]).parse(customer.gender);
      const email=String(customer.email||"").trim().toLowerCase();
      if(!z.string().email().safeParse(email).success)throw new Error("Укажите корректный email для отправки билета");
      const category=link.category??link.table?.category??link.event.categories.find(item=>!item.hidden&&item.sold<item.capacity)??null;
      if(!category)throw new Error("Для списка нет доступной категории билета");
      const firstName=(customer.firstName||"").trim();const lastName=(customer.lastName||"").trim();const fullName=`${firstName} ${lastName}`.trim();const phone=normalizePhone(customer.phone||"");const birthDate=customer.birthDate?new Date(customer.birthDate):new Date("1900-01-01T00:00:00.000Z");
      const order=await db.$transaction(async tx=>{
        await tx.$queryRawUnsafe(`SELECT "id" FROM "PromoterLink" WHERE "id"=$1 FOR UPDATE`,link.id);
        const fresh=await tx.promoterLink.findUnique({where:{id:link.id},select:{active:true,startsAt:true,endsAt:true,guestLimit:true}});
        const txNow=new Date();
        if(!fresh||!fresh.active||(fresh.startsAt&&fresh.startsAt>txNow)||(fresh.endsAt&&fresh.endsAt<txNow))throw new Error("Гостевой список сейчас недоступен");
        const activeOrders=await tx.order.findMany({where:{promoterLinkId:link.id,status:{notIn:["CANCELLED","REJECTED"]}},select:{items:{select:{quantity:true}}}});
        const used=activeOrders.flatMap(item=>item.items).reduce((sum,item)=>sum+item.quantity,0);
        const limit=fresh.guestLimit??link.table?.seats??category.capacity;
        if(used>=limit)throw new Error("Лимит гостей исчерпан");
        const capacityClaim=await tx.ticketCategory.updateMany({where:{id:category.id,sold:{lt:category.capacity}},data:{sold:{increment:1}}});
        if(capacityClaim.count!==1)throw new Error("Бесплатные билеты закончились");
        const guest=await tx.guestProfile.upsert({where:{organizationId_phone:{organizationId:link.event.organizationId,phone}},create:{organizationId:link.event.organizationId,firstName,lastName,phone,email,birthDate,city:customer.city||"",facebook:customer.facebook||"",instagram:customer.instagram||""},update:{firstName,lastName,email,birthDate,city:customer.city||"",facebook:customer.facebook||"",instagram:customer.instagram||""}});
        return tx.order.create({data:{publicId:orderNumber(),idempotencyKey:randomUUID(),customerName:fullName,customerFirstName:firstName,customerLastName:lastName,customerPhone:phone,customerEmail:email,customerBirthDate:customer.birthDate?birthDate:null,customerCity:customer.city||null,customerFacebook:customer.facebook||null,customerInstagram:customer.instagram||null,guestId:guest.id,totalMinor:0,currency:category.currency,status:"PAID",eventId:link.eventId,promoterLinkId:link.id,items:{create:[{quantity:1,unitPriceMinor:0,categoryName:category.name,tableId:link.tableId}]},tickets:{create:[{publicCode:ticketCode(),holderName:fullName,categoryId:category.id}]}},include:{tickets:true}});
      });
      await saveCustomerDemographics({orderId:order.id,guestId:order.guestId,gender,birthDate:customer.birthDate?birthDate:null});
      after(async()=>{
        try{
          const delivery=await sendOrderTicketEmail(order.publicId);
          console.info("[guest-ticket-email] sent",{orderId:order.publicId,recipient:email,resendId:delivery.id});
        }catch(error){
          const message=error instanceof Error?error.message:"Ошибка отправки билета";
          console.error("[guest-ticket-email] failed",{orderId:order.publicId,recipient:email,message});
        }
      });
      return NextResponse.json({ok:true,orderId:order.id,publicId:order.publicId,emailQueued:true},{status:201});
    }
    if(body.action==="remove"){const input=removeSchema.parse(body);const order=link.orders.find(item=>item.id===input.orderId);if(!order)throw new Error("Гость не найден");if(order.tickets.some(ticket=>ticket.status==="USED"))throw new Error("Нельзя удалить гостя после прохода");const quantity=order.items.reduce((sum,item)=>sum+item.quantity,0);const categoryId=order.tickets[0]?.categoryId;await db.$transaction(async tx=>{await tx.ticket.updateMany({where:{orderId:order.id},data:{status:"CANCELLED"}});await tx.order.update({where:{id:order.id},data:{status:"CANCELLED"}});if(categoryId)await tx.ticketCategory.updateMany({where:{id:categoryId,sold:{gte:quantity}},data:{sold:{decrement:quantity}}});});return NextResponse.json({ok:true});}
    throw new Error("Неизвестное действие");
  }catch(error){const message=error instanceof Error?error.message:"Ошибка";console.error("[guest-list-api]",{message});return NextResponse.json({error:message},{status:400});}
}
