import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkoutSchema } from "@/lib/schemas";
import { effectiveTicketPrice, orderNumber } from "@/lib/ticketing";
import { guestFieldKeys, parseGuestFields } from "@/lib/event-guest-fields";
import { assertInventoryAvailable, createReservation, type ReservationItemInput } from "@/lib/reservation";
import { CART_SESSION_COOKIE, releaseCartHold } from "@/lib/cart-hold";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";
import { createHypApprovalPaymentPage } from "@/lib/hyp-creditguard";
import { ensureMarketingRuntime, parseMarketingCookie, saveOrderAttribution } from "@/lib/marketing-runtime";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";
import { localeConfig, normalizeLocale, type Locale } from "@/lib/i18n";

const APP_URL="https://www.atlas-one.co";
function phone(value:string){const digits=value.replace(/\D/g,"");if(!digits)return"";if(digits.startsWith("972"))return`+${digits}`;if(digits.startsWith("0"))return`+972${digits.slice(1)}`;return`+972${digits}`;}
function launch(value:string){return `/payments/hyp/launch?target=${encodeURIComponent(value)}`;}
function cookieValue(req:Request,name:string){const raw=req.headers.get("cookie")||"";for(const part of raw.split(";")){const[key,...rest]=part.trim().split("=");if(key===name)return decodeURIComponent(rest.join("="));}return"";}
async function paymentUrl(input:{mode:"INSTANT"|"APPROVAL_REQUIRED";total:number;id:string;title:string;name:string;email:string;phone:string;language:"HEB"|"ENG"}){
  if(input.mode==="APPROVAL_REQUIRED")return createHypApprovalPaymentPage({amountMinor:input.total,orderId:input.id,callbackPath:"/api/payments/hyp/approval",language:input.language,customerName:input.name,customerEmail:input.email,customerPhone:input.phone});
  return createHypPaymentLink({amountIls:input.total/100,orderId:input.id,description:input.title,customerName:input.name,customerEmail:input.email,customerPhone:input.phone,returnUrl:`${APP_URL}/api/payments/hyp/order`,language:input.language});
}
const copy={
  ru:{generic:"Не удалось подготовить оплату",empty:"Корзина пуста",event:"Мероприятие недоступно для продажи",required:"Заполните все обязательные поля",email:"Укажите корректный email",tariff:"Один из тарифов недоступен",duplicate:"Одно место нельзя добавить в заказ дважды",tables:"Один из выбранных столов больше недоступен",seats:"Одно из выбранных мест больше недоступно",linkInvalid:"Персональная ссылка недействительна",linkUnavailable:"Персональная ссылка больше недоступна",category:"Эта ссылка предназначена для другой категории",table:"Эта ссылка предназначена для другого стола",tableMissing:"Стол не найден",seatCount:"Количество мест в позиции изменилось",seatMissing:"Место не найдено",quota:"Квота этой персональной ссылки исчерпана",inventory:"Недостаточно доступных билетов",tempTable:"Этот стол уже временно забронирован",tempSeat:"Это место уже временно забронировано"},
  he:{generic:"לא ניתן להכין את התשלום",empty:"העגלה ריקה",event:"האירוע אינו זמין כרגע למכירה",required:"יש למלא את כל שדות החובה",email:"יש להזין כתובת Email תקינה",tariff:"אחד מסוגי הכרטיסים אינו זמין",duplicate:"לא ניתן להוסיף את אותו מקום פעמיים להזמנה",tables:"אחד השולחנות שנבחרו אינו זמין עוד",seats:"אחד המקומות שנבחרו אינו זמין עוד",linkInvalid:"הקישור האישי אינו תקף",linkUnavailable:"הקישור האישי אינו זמין עוד",category:"הקישור הזה מיועד לקטגוריה אחרת",table:"הקישור הזה מיועד לשולחן אחר",tableMissing:"השולחן לא נמצא",seatCount:"מספר המקומות בפריט השתנה",seatMissing:"המקום לא נמצא",quota:"המכסה של הקישור האישי נוצלה",inventory:"אין מספיק כרטיסים זמינים",tempTable:"השולחן כבר שמור זמנית",tempSeat:"המקום כבר שמור זמנית"},
  en:{generic:"Could not prepare payment",empty:"Your cart is empty",event:"This event is not currently available for sale",required:"Complete all required fields",email:"Enter a valid email address",tariff:"One of the ticket types is unavailable",duplicate:"The same seat cannot be added twice",tables:"One of the selected tables is no longer available",seats:"One of the selected seats is no longer available",linkInvalid:"The personal link is invalid",linkUnavailable:"The personal link is no longer available",category:"This link is assigned to a different category",table:"This link is assigned to a different table",tableMissing:"Table not found",seatCount:"The number of seats in this item has changed",seatMissing:"Seat not found",quota:"The quota for this personal link has been reached",inventory:"Not enough tickets are available",tempTable:"This table is temporarily reserved",tempSeat:"This seat is temporarily reserved"},
} as const;
function checkoutError(error:unknown,locale:Locale){const raw=error instanceof Error?error.message:"";const c=copy[locale];if(raw.includes("Корзина пуста"))return c.empty;if(raw.includes("Мероприятие недоступно"))return c.event;if(raw.startsWith("Заполните обязательное поле"))return c.required;if(raw.includes("корректный email"))return c.email;if(raw.includes("тарифов недоступен"))return c.tariff;if(raw.includes("место нельзя добавить"))return c.duplicate;if(raw.includes("выбранных столов больше недоступен"))return c.tables;if(raw.includes("выбранных мест больше недоступно"))return c.seats;if(raw.includes("Персональная ссылка недействительна"))return c.linkInvalid;if(raw.includes("Персональная ссылка больше недоступна"))return c.linkUnavailable;if(raw.includes("предназначена для другой категории"))return c.category;if(raw.includes("предназначена для другого стола"))return c.table;if(raw==="Стол не найден")return c.tableMissing;if(raw.includes("Количество мест в позиции"))return c.seatCount;if(raw==="Место не найдено")return c.seatMissing;if(raw.includes("Квота этой персональной ссылки"))return c.quota;if(raw.startsWith("Недостаточно доступных билетов")){const name=raw.replace("Недостаточно доступных билетов","").trim();return name?`${c.inventory}: ${name}`:c.inventory;}if(raw.includes("стол уже временно забронирован")||raw.includes("стол только что был временно забронирован"))return c.tempTable;if(raw.includes("место уже временно забронировано")||raw.includes("место только что было временно забронировано"))return c.tempSeat;const max=/В одном заказе можно купить не более (\d+) билетов/.exec(raw);if(max)return locale==="he"?`ניתן לרכוש עד ${max[1]} כרטיסים בהזמנה`:locale==="en"?`You can buy up to ${max[1]} tickets per order`:`В одном заказе можно купить не более ${max[1]} билетов`;const linkMax=/По этой ссылке можно купить не более (\d+) билетов/.exec(raw);if(linkMax)return locale==="he"?`דרך הקישור הזה ניתן לרכוש עד ${linkMax[1]} כרטיסים בהזמנה`:locale==="en"?`This link allows up to ${linkMax[1]} tickets per order`:`По этой ссылке можно купить не более ${linkMax[1]} билетов за заказ`;return c.generic;}
function fallbackGuest(locale:Locale){return locale==="he"?"אורח":locale==="en"?"Guest":"Гость";}

export async function POST(req:Request){
  let responseLocale:Locale="ru";
  try{
    await ensureMarketingRuntime();
    const attribution=parseMarketingCookie(req.headers.get("cookie"));
    const cartSessionId=cookieValue(req,CART_SESSION_COOKIE);
    const raw=await req.json();responseLocale=normalizeLocale((raw as {locale?:string})?.locale);const input=checkoutSchema.parse(raw);
    const items=input.items;if(!items?.length)throw new Error("Корзина пуста");
    const existing=await db.order.findUnique({where:{idempotencyKey:input.idempotencyKey},include:{event:true}});
    if(existing){
      const existingLocale=normalizeLocale(existing.communicationLocale);responseLocale=existingLocale;const language=localeConfig[existingLocale].hypLanguage;
      if(existing.status==="PENDING"){const url=await paymentUrl({mode:existing.event.salesMode,total:existing.totalMinor,id:existing.publicId,title:existing.event.title,name:existing.customerName,email:existing.customerEmail,phone:existing.customerPhone,language});return NextResponse.json({orderId:existing.publicId,status:existing.status,paymentUrl:launch(url),locale:existingLocale});}
      return NextResponse.json({orderId:existing.publicId,status:existing.status,locale:existingLocale});
    }
    const result=await db.$transaction(async tx=>{
      const event=await tx.event.findUnique({where:{id:input.eventId}});if(!event||event.status!=="PUBLISHED")throw new Error("Мероприятие недоступно для продажи");const eventLocale=normalizeLocale(event.customerCommunicationLocale);responseLocale=eventLocale;
      const fields=parseGuestFields(event.description);for(const key of guestFieldKeys){const value=String(input.customer[key]||"").trim();if(fields[key].visible&&fields[key].required&&!value)throw new Error(`Заполните обязательное поле: ${key}`);}if(input.customer.email&&!/^\S+@\S+\.\S+$/.test(input.customer.email))throw new Error("Укажите корректный email");
      const categoryIds=[...new Set(items.map(item=>item.categoryId))];
      const categories=await tx.ticketCategory.findMany({where:{id:{in:categoryIds}},include:{priceTiers:true}});
      if(categories.length!==categoryIds.length||categories.some(category=>category.eventId!==event.id||category.hidden))throw new Error("Один из тарифов недоступен");
      const eventOrderLimit=await tx.ticketCategory.aggregate({where:{eventId:event.id,hidden:false},_max:{maxPerOrder:true}});
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
      const maxOrderQuantity=Math.max(1,eventOrderLimit._max.maxPerOrder??1);if(totalQuantity>maxOrderQuantity)throw new Error(`В одном заказе можно купить не более ${maxOrderQuantity} билетов`);
      if(promoter&&totalQuantity>promoter.maxPerOrder)throw new Error(`По этой ссылке можно купить не более ${promoter.maxPerOrder} билетов за заказ`);
      if(promoter?.guestLimit){const allocated=promoter.orders.flatMap(order=>order.items).reduce((sum,item)=>sum+item.quantity,0);if(allocated+totalQuantity>promoter.guestLimit)throw new Error("Квота этой персональной ссылки исчерпана");}
      const capacities=new Map([...requested].map(([id,value])=>[id,{sold:value.sold,capacity:value.capacity,name:value.name}]));
      if(cartSessionId)await releaseCartHold({sessionId:cartSessionId,eventId:event.id,executor:tx});
      await assertInventoryAvailable({items:reservationItems,capacities,executor:tx});
      let discount=0;if(input.promoCode){const promo=await tx.promoCode.findUnique({where:{eventId_code:{eventId:event.id,code:input.promoCode.toUpperCase()}}});if(promo?.active)discount=promo.discountPercent;}subtotal=Math.round(subtotal*(100-discount)/100);
      const terms=await getEffectiveEventTerms(event.id,event.organizationId);const pricing=calculateServiceFee(subtotal,{salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer});
      const firstName=input.customer.firstName.trim()||fallbackGuest(eventLocale);const lastName=input.customer.lastName.trim();const name=`${firstName} ${lastName}`.trim();const email=(input.customer.email||`guest-${crypto.randomUUID()}@guest.atlas.local`).toLowerCase();const rawPhone=input.customer.phone.trim();const normalized=phone(rawPhone)||`guest-${crypto.randomUUID()}`;const birthDate=input.customer.birthDate?new Date(input.customer.birthDate):new Date("1900-01-01T00:00:00.000Z");
      const guest=await tx.guestProfile.upsert({where:{organizationId_phone:{organizationId:event.organizationId,phone:normalized}},create:{organizationId:event.organizationId,firstName,lastName,phone:normalized,email,birthDate,city:input.customer.city||"",facebook:input.customer.facebook||"",instagram:input.customer.instagram||""},update:{firstName,lastName,email,birthDate,city:input.customer.city||"",facebook:input.customer.facebook||"",instagram:input.customer.instagram||""}});
      const created=await tx.order.create({data:{publicId:orderNumber(),idempotencyKey:input.idempotencyKey,communicationLocale:eventLocale,customerName:name,customerEmail:email,customerPhone:rawPhone?normalized:"",customerFirstName:input.customer.firstName||null,customerLastName:lastName||null,customerBirthDate:input.customer.birthDate?birthDate:null,customerCity:input.customer.city||null,customerFacebook:input.customer.facebook||null,customerInstagram:input.customer.instagram||null,guestId:guest.id,eligibilityAnswer:input.eligibilityAnswer||null,totalMinor:pricing.buyerTotalMinor,status:"PENDING",eventId:event.id,referralId:legacy?.id,promoterLinkId:promoter?.id,items:{create:orderItems}}});
      await tx.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderCommercialSnapshot" ("orderId" TEXT PRIMARY KEY,"subtotalMinor" INTEGER NOT NULL,"serviceFeeMinor" INTEGER NOT NULL,"buyerTotalMinor" INTEGER NOT NULL,"organizerNetMinor" INTEGER NOT NULL,"serviceFeePayer" TEXT NOT NULL,"salesFeePercentBps" INTEGER NOT NULL,"salesFeeFixedMinor" INTEGER NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
      await tx.$executeRawUnsafe(`INSERT INTO "OrderCommercialSnapshot" ("orderId","subtotalMinor","serviceFeeMinor","buyerTotalMinor","organizerNetMinor","serviceFeePayer","salesFeePercentBps","salesFeeFixedMinor") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT ("orderId") DO NOTHING`,created.id,pricing.subtotalMinor,pricing.serviceFeeMinor,pricing.buyerTotalMinor,pricing.organizerNetMinor,terms.serviceFeePayer,terms.organizer.salesFeePercentBps,terms.organizer.salesFeeFixedMinor);
      await saveOrderAttribution(tx,created.id,attribution);await createReservation({orderId:created.id,items:reservationItems,ttlMinutes:event.salesMode==="INSTANT"?15:24*60,executor:tx});
      return{order:created,event,eventLocale};
    });
    const url=await paymentUrl({mode:result.event.salesMode,total:result.order.totalMinor,id:result.order.publicId,title:result.event.title,name:result.order.customerName,email:result.order.customerEmail,phone:result.order.customerPhone,language:localeConfig[result.eventLocale].hypLanguage});
    return NextResponse.json({orderId:result.order.publicId,status:result.order.status,paymentUrl:launch(url),locale:result.eventLocale},{status:201});
  }catch(error){console.error("[checkout-cart]",error);return NextResponse.json({error:checkoutError(error,responseLocale)},{status:400});}
}
