import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkoutSchema } from "@/lib/schemas";
import { effectiveTicketPrice, orderNumber } from "@/lib/ticketing";
import { guestFieldKeys, parseGuestFields } from "@/lib/event-guest-fields";
import { assertInventoryAvailable, createReservation, type ReservationItemInput } from "@/lib/reservation";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";
import { createHypApprovalPaymentPage } from "@/lib/hyp-creditguard";
import { ensureMarketingRuntime, parseMarketingCookie, saveOrderAttribution } from "@/lib/marketing-runtime";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";

const APP_URL="https://www.atlas-one.co";
function phone(value:string){const digits=value.replace(/\D/g,"");if(!digits)return"";if(digits.startsWith("972"))return`+${digits}`;if(digits.startsWith("0"))return`+972${digits.slice(1)}`;return`+972${digits}`;}
function launch(value:string){return `/payments/hyp/launch?target=${encodeURIComponent(value)}`;}
async function paymentUrl(input:{mode:"INSTANT"|"APPROVAL_REQUIRED";total:number;id:string;title:string;name:string;email:string;phone:string;language:"HEB"|"ENG"}){
  if(input.mode==="APPROVAL_REQUIRED")return createHypApprovalPaymentPage({amountMinor:input.total,orderId:input.id,callbackPath:"/api/payments/hyp/approval",language:input.language,customerName:input.name,customerEmail:input.email,customerPhone:input.phone});
  return createHypPaymentLink({amountIls:input.total/100,orderId:input.id,description:input.title,customerName:input.name,customerEmail:input.email,customerPhone:input.phone,returnUrl:`${APP_URL}/api/payments/hyp/order`,language:input.language});
}

export async function POST(req:Request){
  try{
    await ensureMarketingRuntime();
    const attribution=parseMarketingCookie(req.headers.get("cookie"));
    const input=checkoutSchema.parse(await req.json());
    const items=input.items;if(!items?.length)throw new Error("Корзина пуста");
    const language=input.locale==="he"?"HEB" as const:"ENG" as const;
    const existing=await db.order.findUnique({where:{idempotencyKey:input.idempotencyKey},include:{event:true}});
    if(existing){
      if(existing.status==="PENDING"){const url=await paymentUrl({mode:existing.event.salesMode,total:existing.totalMinor,id:existing.publicId,title:existing.event.title,name:existing.customerName,email:existing.customerEmail,phone:existing.customerPhone,language});return NextResponse.json({orderId:existing.publicId,status:existing.status,paymentUrl:launch(url)});}
      return NextResponse.json({orderId:existing.publicId,status:existing.status});
    }
    const result=await db.$transaction(async tx=>{
      const event=await tx.event.findUnique({where:{id:input.eventId}});if(!event||event.status!=="PUBLISHED")throw new Error("Мероприятие недоступно для продажи");
      const fields=parseGuestFields(event.description);for(const key of guestFieldKeys){const value=String(input.customer[key]||"").trim();if(fields[key].visible&&fields[key].required&&!value)throw new Error(`Заполните обязательное поле: ${key}`);}if(input.customer.email&&!/^\S+@\S+\.\S+$/.test(input.customer.email))throw new Error("Укажите корректный email");
      const categoryIds=[...new Set(items.map(item=>item.categoryId))];
      const categories=await tx.ticketCategory.findMany({where:{id:{in:categoryIds}},include:{priceTiers:true}});
      if(categories.length!==categoryIds.length||categories.some(category=>category.eventId!==event.id||category.hidden))throw new Error("Один из тарифов недоступен");
      const categoryMap=new Map(categories.map(category=>[category.id,category]));
      const tableIds=[...new Set(items.flatMap(item=>item.tableId?[item.tableId]:[]))];
      const seatIds=items.flatMap(item=>item.seatIds);
      if(new Set(seatIds).size!==seatIds.length)throw new Error("Одно место нельзя добавить в заказ дважды");
      const[tables,seats]=await Promise.all([
        tableIds.length?tx.table.findMany({where:{id:{in:tableIds}},include:{zone:true,category:{include:{priceTiers:true}}}}):[],
        seatIds.length?tx.seat.findMany({where:{id:{in:seatIds}},include:{category:{include:{priceTiers:true}},table:{include:{zone:true}}}}):[],
      ]);
      if(tables.length!==tableIds.length||tables.some(table=>table.zone.eventId!==event.id||table.reserved||table.priceMode!=="WHOLE_TABLE"||!table.category))throw new Error("Один из выбранных столов больше недоступен");
      if(seats.length!==seatIds.length||seats.some(seat=>seat.table.zone.eventId!==event.id||seat.table.priceMode!=="PER_SEAT"||seat.status!=="AVAILABLE"||!seat.category))throw new Error("Одно из выбранных мест больше недоступно");
      const tableMap=new Map(tables.map(table=>[table.id,table]));
      const seatMap=new Map(seats.map(seat=>[seat.id,seat]));
      const now=new Date();
      const promoter=input.referralCode?await tx.promoterLink.findUnique({where:{code:input.referralCode.toUpperCase()},include:{orders:{where:{status:{notIn:["CANCELLED","REJECTED"]}},include:{items:true}}}}):null;
      const legacy=input.referralCode&&!promoter?await tx.referral.findUnique({where:{code:input.referralCode}}):null;
      if(input.referralCode&&!promoter&&!legacy)throw new Error("Персональная ссылка недействительна");
      if(promoter&&(!promoter.active||promoter.eventId!==event.id||(promoter.startsAt&&promoter.startsAt>now)||(promoter.endsAt&&promoter.endsAt<now)))throw new Error("Персональная ссылка больше недоступна");
      if(promoter?.allocationType==="CATEGORY"&&items.some(item=>item.categoryId!==promoter.categoryId))throw new Error("Эта ссылка предназначена для другой категории");
      if(promoter?.allocationType==="TABLE"&&items.some(item=>item.tableId!==promoter.tableId))throw new Error("Эта ссылка предназначена для другого стола");
      const reservationItems:ReservationItemInput[]=[];const orderItems:Array<{quantity:number;unitPriceMinor:number;categoryName:string;tableId?:string;seatId?:string}>=[];
      const requested=new Map<string,{sold:number;capacity:number;name:string;minPerOrder:number;maxPerOrder:number;quantity:number}>();
      let subtotal=0;let totalQuantity=0;
      for(const item of items){
        const baseCategory=categoryMap.get(item.categoryId)!;totalQuantity+=item.quantity;
        if(item.tableId){
          const table=tableMap.get(item.tableId);if(!table?.category)throw new Error("Стол не найден");
          const price=promoter?.customPriceMinor??effectiveTicketPrice(table.category,now);subtotal+=price;
          reservationItems.push({categoryId:table.category.id,quantity:table.seats,tableId:table.id,seatId:null});
          orderItems.push({quantity:table.seats,unitPriceMinor:Math.round(price/table.seats),categoryName:table.category.name,tableId:table.id});
          const current=requested.get(table.category.id);requested.set(table.category.id,{sold:table.category.sold,capacity:table.category.capacity,name:table.category.name,minPerOrder:table.category.minPerOrder,maxPerOrder:table.category.maxPerOrder,quantity:(current?.quantity??0)+table.seats});
        }else if(item.seatIds.length){
          if(item.quantity!==item.seatIds.length)throw new Error("Количество мест в позиции изменилось");
          for(const id of item.seatIds){const seat=seatMap.get(id);if(!seat?.category)throw new Error("Место не найдено");const price=promoter?.customPriceMinor??effectiveTicketPrice(seat.category,now);subtotal+=price;reservationItems.push({categoryId:seat.category.id,quantity:1,seatId:seat.id,tableId:null});orderItems.push({quantity:1,unitPriceMinor:price,categoryName:seat.category.name,tableId:seat.tableId,seatId:seat.id});const current=requested.get(seat.category.id);requested.set(seat.category.id,{sold:seat.category.sold,capacity:seat.category.capacity,name:seat.category.name,minPerOrder:seat.category.minPerOrder,maxPerOrder:seat.category.maxPerOrder,quantity:(current?.quantity??0)+1});}
        }else{
          const price=promoter?.customPriceMinor??effectiveTicketPrice(baseCategory,now);subtotal+=price*item.quantity;reservationItems.push({categoryId:baseCategory.id,quantity:item.quantity,tableId:null,seatId:null});orderItems.push({quantity:item.quantity,unitPriceMinor:price,categoryName:baseCategory.name});const current=requested.get(baseCategory.id);requested.set(baseCategory.id,{sold:baseCategory.sold,capacity:baseCategory.capacity,name:baseCategory.name,minPerOrder:baseCategory.minPerOrder,maxPerOrder:baseCategory.maxPerOrder,quantity:(current?.quantity??0)+item.quantity});
        }
      }
      for(const category of requested.values())if(category.quantity<category.minPerOrder||category.quantity>category.maxPerOrder)throw new Error(`Для ${category.name} можно выбрать от ${category.minPerOrder} до ${category.maxPerOrder} билетов в одном заказе`);
      if(promoter&&totalQuantity>promoter.maxPerOrder)throw new Error(`По этой ссылке можно купить не более ${promoter.maxPerOrder} билетов за заказ`);
      if(promoter?.guestLimit){const allocated=promoter.orders.flatMap(order=>order.items).reduce((sum,item)=>sum+item.quantity,0);if(allocated+totalQuantity>promoter.guestLimit)throw new Error("Квота этой персональной ссылки исчерпана");}
      const capacities=new Map([...requested].map(([id,value])=>[id,{sold:value.sold,capacity:value.capacity,name:value.name}]));await assertInventoryAvailable({items:reservationItems,capacities,executor:tx});
      let discount=0;if(input.promoCode){const promo=await tx.promoCode.findUnique({where:{eventId_code:{eventId:event.id,code:input.promoCode.toUpperCase()}}});if(promo?.active)discount=promo.discountPercent;}subtotal=Math.round(subtotal*(100-discount)/100);
      const terms=await getEffectiveEventTerms(event.id,event.organizationId);const pricing=calculateServiceFee(subtotal,{salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer});
      const firstName=input.customer.firstName.trim()||"Гость";const lastName=input.customer.lastName.trim();const name=`${firstName} ${lastName}`.trim();const email=(input.customer.email||`guest-${crypto.randomUUID()}@guest.atlas.local`).toLowerCase();const rawPhone=input.customer.phone.trim();const normalized=phone(rawPhone)||`guest-${crypto.randomUUID()}`;const birthDate=input.customer.birthDate?new Date(input.customer.birthDate):new Date("1900-01-01T00:00:00.000Z");
      const guest=await tx.guestProfile.upsert({where:{organizationId_phone:{organizationId:event.organizationId,phone:normalized}},create:{organizationId:event.organizationId,firstName,lastName,phone:normalized,email,birthDate,city:input.customer.city||"",facebook:input.customer.facebook||"",instagram:input.customer.instagram||""},update:{firstName,lastName,email,birthDate,city:input.customer.city||"",facebook:input.customer.facebook||"",instagram:input.customer.instagram||""}});
      const created=await tx.order.create({data:{publicId:orderNumber(),idempotencyKey:input.idempotencyKey,customerName:name,customerEmail:email,customerPhone:rawPhone?normalized:"",customerFirstName:input.customer.firstName||null,customerLastName:lastName||null,customerBirthDate:input.customer.birthDate?birthDate:null,customerCity:input.customer.city||null,customerFacebook:input.customer.facebook||null,customerInstagram:input.customer.instagram||null,guestId:guest.id,eligibilityAnswer:input.eligibilityAnswer||null,totalMinor:pricing.buyerTotalMinor,status:"PENDING",eventId:event.id,referralId:legacy?.id,promoterLinkId:promoter?.id,items:{create:orderItems}}});
      await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderCommercialSnapshot" ("orderId" TEXT PRIMARY KEY,"subtotalMinor" INTEGER NOT NULL,"serviceFeeMinor" INTEGER NOT NULL,"buyerTotalMinor" INTEGER NOT NULL,"organizerNetMinor" INTEGER NOT NULL,"serviceFeePayer" TEXT NOT NULL,"salesFeePercentBps" INTEGER NOT NULL,"salesFeeFixedMinor" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await tx.$executeRawUnsafe(`INSERT INTO "OrderCommercialSnapshot" ("orderId","subtotalMinor","serviceFeeMinor","buyerTotalMinor","organizerNetMinor","serviceFeePayer","salesFeePercentBps","salesFeeFixedMinor") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("orderId") DO NOTHING`,created.id,pricing.subtotalMinor,pricing.serviceFeeMinor,pricing.buyerTotalMinor,pricing.organizerNetMinor,terms.serviceFeePayer,terms.organizer.salesFeePercentBps,terms.organizer.salesFeeFixedMinor);
      await saveOrderAttribution(tx,created.id,attribution);await createReservation({orderId:created.id,items:reservationItems,ttlMinutes:event.salesMode==="INSTANT"?15:24*60,executor:tx});
      return{order:created,event};
    });
    const url=await paymentUrl({mode:result.event.salesMode,total:result.order.totalMinor,id:result.order.publicId,title:result.event.title,name:result.order.customerName,email:result.order.customerEmail,phone:result.order.customerPhone,language});
    return NextResponse.json({orderId:result.order.publicId,status:result.order.status,paymentUrl:launch(url)},{status:201});
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Некорректный запрос"},{status:400});}
}
