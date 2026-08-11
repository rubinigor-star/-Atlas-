import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { effectiveTicketPrice, ticketPricePresentation } from "@/lib/ticketing";
import { parsePricingMarketingStrategy } from "@/lib/ticket-pricing-strategy";
import { parseTicketSalesStrategy } from "@/lib/ticket-sales-strategy";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { getServerI18n } from "@/lib/server-locale";
import { EventSeatSelection } from "@/components/event-seat-selection";

export const dynamic="force-dynamic";

export default async function EventSeatsPage({ params, searchParams }: { params:Promise<{slug:string}>; searchParams:Promise<Record<string,string|undefined>> }) {
  const [{slug},query] = await Promise.all([params,searchParams]);
  const event = await db.event.findUnique({ where:{slug}, include:{ venue:true, categories:{include:{priceTiers:true}} } });
  if(!event || event.status!=="PUBLISHED") notFound();
  if(!event.mapEnabled) redirect(`/events/${slug}`);

  const channelCode=query.ref||query.channel;
  const [promoterLink,zones,commercialTerms,i18n]=await Promise.all([
    channelCode?db.promoterLink.findUnique({where:{code:channelCode.toUpperCase()}}):Promise.resolve(null),
    db.zone.findMany({where:{eventId:event.id},select:{name:true,tables:{include:{seatItems:{orderBy:{position:"asc"}}}}}}),
    getEffectiveEventTerms(event.id,event.organizationId),
    getServerI18n(),
  ]);

  const now=new Date();
  const validPromoterLink=promoterLink&&promoterLink.eventId===event.id&&promoterLink.active&&(!promoterLink.startsAt||promoterLink.startsAt<=now)&&(!promoterLink.endsAt||promoterLink.endsAt>=now)?promoterLink:null;
  const categories=event.categories.flatMap(category=>{
    if(category.hidden)return[];
    try{
      const standardPrice=effectiveTicketPrice(category,now);
      const channelPrice=validPromoterLink?.allocationType==="CATEGORY"&&validPromoterLink.categoryId===category.id&&validPromoterLink.customPriceMinor!==null?validPromoterLink.customPriceMinor:standardPrice;
      return [{
        id:category.id,
        name:category.name,
        priceMinor:channelPrice,
        colorHex:category.colorHex,
        capacity:category.capacity,
        sold:category.sold,
        pricingPresentation:ticketPricePresentation(category,now),
        marketingStrategy:parsePricingMarketingStrategy(category.description),
        salesStrategy:parseTicketSalesStrategy(category.description),
      }];
    }catch{return[];}
  });
  if(!categories.length)notFound();

  const objects=zones.flatMap(zone=>zone.tables.map(table=>({
    id:table.id,
    label:table.label,
    seats:table.seats,
    priceMinor:table.priceMinor,
    priceMode:table.priceMode,
    objectType:table.objectType,
    x:table.x,
    y:table.y,
    rotation:table.rotation,
    width:table.width,
    height:table.height,
    reserved:table.reserved||table.seatItems.some(seat=>seat.status!=="AVAILABLE"&&table.priceMode==="WHOLE_TABLE"),
    categoryId:table.categoryId,
    seatItems:table.seatItems.map(seat=>({id:seat.id,label:seat.label,position:seat.position,status:seat.status,categoryId:seat.categoryId})),
  })));

  const feeTerms={salesFeePercentBps:commercialTerms.organizer.salesFeePercentBps,salesFeeFixedMinor:commercialTerms.organizer.salesFeeFixedMinor,serviceFeePayer:commercialTerms.serviceFeePayer};
  const parsedQty=Number.parseInt(query.qty||"2",10);
  const initialQty=Number.isFinite(parsedQty)?Math.max(1,Math.min(10,parsedQty)):2;
  const allocation=validPromoterLink?{type:validPromoterLink.allocationType,categoryId:validPromoterLink.categoryId,tableId:validPromoterLink.tableId,customPriceMinor:validPromoterLink.customPriceMinor}:undefined;

  return <EventSeatSelection eventId={event.id} slug={event.slug} title={event.title} posterUrl={event.posterUrl} venueName={event.venue.name} categories={categories} objects={objects} feeTerms={feeTerms} referralCode={validPromoterLink?.code} allocation={allocation} initialQty={initialQty}/>;
}
