import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { effectiveTicketPrice, ticketPricePresentation } from "@/lib/ticketing";
import { parsePricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { parseTicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { getServerI18n } from "@/lib/server-locale";
import { getActiveGuestSeatLocks } from "@/lib/guest-links";
import { CART_SESSION_COOKIE, cartHoldOrderId, getHeldInventory } from "@/lib/cart-hold";
import { EventSeatSelection } from "@/components/event-seat-selection";
import { SeatHoldBridge } from "@/components/seat-hold-bridge";

export const dynamic="force-dynamic";
function cssAttr(value:string){return value.replace(/\\/g,"\\\\").replace(/\"/g,"\\\"");}
function isInternalMapLabel(value:string){return value.startsWith("__ATLAS_")||value.startsWith("READING_V3_");}

export default async function EventSeatsPage({ params, searchParams }: { params:Promise<{slug:string}>; searchParams:Promise<Record<string,string|undefined>> }) {
  const [{slug},query] = await Promise.all([params,searchParams]);
  const event = await db.event.findUnique({ where:{slug}, include:{ venue:true, categories:{include:{priceTiers:true}} } });
  if(!event || event.status!=="PUBLISHED") notFound();
  if(!event.mapEnabled) redirect(`/events/${slug}`);
  const channelCode=query.ref||query.channel;
  const [promoterLink,zones,commercialTerms,i18n,guestSeatLocks,store]=await Promise.all([
    channelCode?db.promoterLink.findUnique({where:{code:channelCode.toUpperCase()}}):Promise.resolve(null),
    db.zone.findMany({where:{eventId:event.id},select:{name:true,tables:{include:{seatItems:{orderBy:{position:"asc"}}}}}}),
    getEffectiveEventTerms(event.id,event.organizationId),
    getServerI18n(),
    getActiveGuestSeatLocks(event.id),
    cookies(),
  ]);
  void i18n;
  const now=new Date();
  const validPromoterLink=promoterLink&&promoterLink.eventId===event.id&&promoterLink.active&&(!promoterLink.startsAt||promoterLink.startsAt<=now)&&(!promoterLink.endsAt||promoterLink.endsAt>=now)?promoterLink:null;
  const categories=event.categories.flatMap(category=>{
    if(category.hidden)return[];
    try{
      const standardPrice=effectiveTicketPrice(category,now);
      const channelPrice=validPromoterLink?.allocationType==="CATEGORY"&&validPromoterLink.categoryId===category.id&&validPromoterLink.customPriceMinor!==null?validPromoterLink.customPriceMinor:standardPrice;
      return [{id:category.id,name:category.name,priceMinor:channelPrice,colorHex:category.colorHex,capacity:category.capacity,sold:category.sold,minPerOrder:category.minPerOrder,maxPerOrder:category.maxPerOrder,pricingPresentation:ticketPricePresentation(category,now),marketingStrategy:parsePricingMarketingStrategy(category.description),salesStrategy:parseTicketSalesStrategy(category.description)}];
    }catch{return[];}
  });
  if(!categories.length)notFound();
  const sessionId=store.get(CART_SESSION_COOKIE)?.value||"";
  const held=await getHeldInventory({categoryIds:categories.map(category=>category.id),excludeOrderId:sessionId?cartHoldOrderId(sessionId,event.id):undefined});
  const heldSeatIds=new Set(held.seatIds);
  const heldTableIds=new Set(held.tableIds);
  const objects=zones.flatMap(zone=>zone.tables.map(table=>({
    id:table.id,label:table.label,seats:table.seats,priceMinor:table.priceMinor,priceMode:table.priceMode,objectType:table.objectType,x:table.x,y:table.y,rotation:table.rotation,width:table.width,height:table.height,
    reserved:table.reserved||heldTableIds.has(table.id)||table.seatItems.some(seat=>(seat.status!=="AVAILABLE"||heldSeatIds.has(seat.id)||guestSeatLocks.has(seat.id))&&table.priceMode==="WHOLE_TABLE"),categoryId:table.categoryId,
    seatItems:table.seatItems.map(seat=>({id:seat.id,label:seat.label,position:seat.position,status:guestSeatLocks.has(seat.id)&&guestSeatLocks.get(seat.id)!==validPromoterLink?.id?"BLOCKED" as const:heldSeatIds.has(seat.id)?"RESERVED" as const:seat.status,categoryId:seat.categoryId})),
  })));
  const categoryColors=new Map(event.categories.map(category=>[category.id,category.colorHex]));
  const categoryNames=new Map(event.categories.map(category=>[category.id,category.name]));
  const categoryPrices=new Map(categories.map(category=>[category.id,category.priceMinor]));
  const assignmentCss=zones.flatMap(zone=>zone.tables.flatMap(table=>table.seatItems.flatMap(seat=>{
    if(seat.status!=="AVAILABLE"||heldSeatIds.has(seat.id)||guestSeatLocks.has(seat.id))return[];
    const categoryId=seat.categoryId??table.categoryId;const color=categoryId?categoryColors.get(categoryId):undefined;if(!color)return[];return [`body.atlas-seat-selection-active button[aria-label="${cssAttr(seat.label)}"]:not([data-price-filtered="true"])::before{background:${color}!important;}`];
  }))).join("\n");
  const publicObjects=objects.filter(object=>!isInternalMapLabel(object.label));
  const zoneAssignmentCss=publicObjects.flatMap((object,index)=>{
    if(object.objectType!=="ZONE"||!object.categoryId)return[];const color=categoryColors.get(object.categoryId);if(!color)return[];const name=categoryNames.get(object.categoryId)??object.label;const priceMinor=categoryPrices.get(object.categoryId)??object.priceMinor;const safeName=cssAttr(name).replace(/'/g,"\\'");return [`body.atlas-seat-selection-active div[class*="world"]>div[class*="object"]:nth-child(${index+1}) div[class*="decorationZONE"]{background:${color}!important;border-color:${color}!important;color:#fff!important;cursor:pointer!important;position:relative!important;}`,`body.atlas-seat-selection-active div[class*="world"]>div[class*="object"]:nth-child(${index+1}) div[class*="decorationZONE"]:hover{filter:brightness(.97);}`,`body.atlas-seat-selection-active div[class*="world"]>div[class*="object"]:nth-child(${index+1}) div[class*="decorationZONE"]:hover:after{content:'${safeName} · ${Math.round(priceMinor/100)}₪';position:absolute;left:50%;top:50%;transform:translate(-50%,42px);z-index:50;background:#fff;color:#111827;border:1px solid #d1d5db;border-radius:8px;padding:10px 12px;box-shadow:0 10px 28px rgba(15,23,42,.16);font-size:13px;font-weight:700;line-height:1.2;white-space:nowrap;pointer-events:none;}`];
  }).join("\n");
  const feeTerms={salesFeePercentBps:commercialTerms.organizer.salesFeePercentBps,salesFeeFixedMinor:commercialTerms.organizer.salesFeeFixedMinor,serviceFeePayer:commercialTerms.serviceFeePayer};const parsedQty=Number.parseInt(query.qty||"2",10);const initialQty=Number.isFinite(parsedQty)?Math.max(1,Math.min(8,parsedQty)):2;const allocation=validPromoterLink?{type:validPromoterLink.allocationType,categoryId:validPromoterLink.categoryId,tableId:validPromoterLink.tableId,customPriceMinor:validPromoterLink.customPriceMinor,maxPerOrder:validPromoterLink.maxPerOrder}:undefined;
  const holdObjects=objects.map(object=>({id:object.id,label:object.label,seats:object.seats,priceMode:object.priceMode,objectType:object.objectType,categoryId:object.categoryId,seatItems:object.seatItems.map(seat=>({id:seat.id,label:seat.label,position:seat.position,categoryId:seat.categoryId}))}));
  return <><style dangerouslySetInnerHTML={{__html:`${assignmentCss}\n${zoneAssignmentCss}\nbutton[data-atlas-remote-held=\"true\"]{opacity:.28!important;filter:grayscale(1)!important;cursor:not-allowed!important;pointer-events:none!important}`}}/><EventSeatSelection eventId={event.id} slug={event.slug} title={event.title} posterUrl={event.posterUrl} venueName={event.venue.name} categories={categories} objects={objects} feeTerms={feeTerms} referralCode={validPromoterLink?.code} allocation={allocation} initialQty={initialQty}/><SeatHoldBridge eventId={event.id} categories={categories.map(category=>({id:category.id,name:category.name}))} objects={holdObjects}/></>;
}