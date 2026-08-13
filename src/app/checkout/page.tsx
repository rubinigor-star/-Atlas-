import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { CheckoutForm } from "@/components/checkout-form";
import { AbandonExitTracker } from "@/components/abandon-exit-tracker";
import { effectiveTicketPrice } from "@/lib/ticketing";
import { parseGuestFields } from "@/lib/event-guest-fields";
import { getEffectiveEventTerms } from "@/lib/commercial-terms";
import { calculateServiceFee } from "@/lib/service-fee";

export const dynamic="force-dynamic";
type CartItem={categoryId:string;quantity:number;tableId?:string|null;seatIds:string[]};

function parseCart(value:string|undefined):CartItem[]{
  if(!value)return[];
  try{
    const parsed=JSON.parse(value);if(!Array.isArray(parsed))return[];
    return parsed.slice(0,20).flatMap((item):CartItem[]=>{
      if(!item||typeof item.categoryId!=="string")return[];
      const quantity=Math.max(1,Math.min(20,Number(item.quantity)||1));
      const seatIds=Array.isArray(item.seatIds)?item.seatIds.filter((id:unknown):id is string=>typeof id==="string").slice(0,20):[];
      return[{categoryId:item.categoryId,quantity,tableId:typeof item.tableId==="string"?item.tableId:null,seatIds}];
    });
  }catch{return[];}
}

export default async function Checkout({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const query=await searchParams;
  const cart=parseCart(query.cart);
  const legacyQuantity=Math.max(1,Math.min(10,Number(query.quantity)||1));
  const legacySeatIds=query.seatIds?.split(",").filter(Boolean).slice(0,10)??[];
  const items:CartItem[]=cart.length?cart:query.categoryId?[{categoryId:query.categoryId,quantity:legacyQuantity,tableId:query.tableId||null,seatIds:legacySeatIds}]:[];
  if(!items.length)notFound();
  const categoryIds=[...new Set(items.map(item=>item.categoryId))];
  const tableIds=[...new Set(items.flatMap(item=>item.tableId?[item.tableId]:[]))];
  const seatIds=[...new Set(items.flatMap(item=>item.seatIds))];
  if(seatIds.length!==items.reduce((sum,item)=>sum+item.seatIds.length,0))notFound();
  const[event,categories,tables,seats,promoterLink,eventOrderLimit]=await Promise.all([
    db.event.findUnique({where:{id:query.eventId}}),
    db.ticketCategory.findMany({where:{id:{in:categoryIds}},include:{priceTiers:true}}),
    tableIds.length?db.table.findMany({where:{id:{in:tableIds}},include:{category:{include:{priceTiers:true}},zone:true}}):[],
    seatIds.length?db.seat.findMany({where:{id:{in:seatIds}},include:{category:{include:{priceTiers:true}},table:{include:{zone:true}}}}):[],
    query.ref?db.promoterLink.findUnique({where:{code:query.ref.toUpperCase()},include:{promoter:true}}):null,
    db.ticketCategory.aggregate({where:{eventId:query.eventId,hidden:false},_max:{maxPerOrder:true}}),
  ]);
  if(!event||categories.length!==categoryIds.length||categories.some(category=>category.eventId!==event.id))notFound();
  if(tables.length!==tableIds.length||tables.some(table=>table.zone.eventId!==event.id||!table.category))notFound();
  if(seats.length!==seatIds.length||seats.some(seat=>seat.table.zone.eventId!==event.id||!seat.category))notFound();
  const now=new Date();
  const validLink=promoterLink&&promoterLink.eventId===event.id&&promoterLink.active&&(!promoterLink.startsAt||promoterLink.startsAt<=now)&&(!promoterLink.endsAt||promoterLink.endsAt>=now)?promoterLink:null;
  if(query.ref&&!validLink)notFound();
  if(validLink?.allocationType==="TABLE"&&items.some(item=>item.tableId!==validLink.tableId))notFound();
  if(validLink?.allocationType==="CATEGORY"&&items.some(item=>item.categoryId!==validLink.categoryId))notFound();
  const categoryMap=new Map(categories.map(category=>[category.id,category]));
  const tableMap=new Map(tables.map(table=>[table.id,table]));
  const seatMap=new Map(seats.map(seat=>[seat.id,seat]));
  const labels:string[]=[];let subtotal=0;let quantity=0;
  for(const item of items){
    const category=categoryMap.get(item.categoryId);if(!category)notFound();quantity+=item.quantity;
    if(item.tableId){
      const table=tableMap.get(item.tableId);if(!table?.category)notFound();
      subtotal+=validLink?.customPriceMinor??effectiveTicketPrice(table.category,now);
      labels.push(`${table.objectType==="SOFA"?"Диван":"Стол"} ${table.label}, ${table.seats} мест целиком`);
    }else if(item.seatIds.length){
      const itemSeats=item.seatIds.map(id=>seatMap.get(id)).filter(Boolean);if(itemSeats.length!==item.seatIds.length)notFound();
      subtotal+=itemSeats.reduce((sum,seat)=>sum+(validLink?.customPriceMinor??effectiveTicketPrice(seat!.category!,now)),0);
      const table=itemSeats[0]!.table;
      labels.push(`${table.objectType==="SOFA"?"Диван":"Стол"} ${table.label}, места ${itemSeats.map(seat=>seat!.position).join(", ")}`);
    }else{
      subtotal+=(validLink?.customPriceMinor??effectiveTicketPrice(category,now))*item.quantity;
      labels.push(`${category.name} × ${item.quantity}`);
    }
  }
  if(quantity>Math.max(1,eventOrderLimit._max.maxPerOrder??1))notFound();
  if(validLink&&quantity>validLink.maxPerOrder)notFound();
  const terms=await getEffectiveEventTerms(event.id,event.organizationId);
  const pricing=calculateServiceFee(subtotal,{salesFeePercentBps:terms.organizer.salesFeePercentBps,salesFeeFixedMinor:terms.organizer.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer});
  const first=items[0];
  return <main className="shell"><AbandonExitTracker eventId={event.id} categoryId={first.categoryId} tableId={first.tableId||undefined} seatIds={seatIds}/><CheckoutForm eventId={event.id} categoryId={first.categoryId} quantity={quantity} items={items} seatIds={seatIds} subtotal={pricing.subtotalMinor} serviceFee={pricing.serviceFeeMinor} total={pricing.buyerTotalMinor} serviceFeePayer={terms.serviceFeePayer} title={event.title} label={labels.join(" · ")} salesMode={event.salesMode} approvalInstructions={event.approvalInstructions} referralCode={validLink?.code} promoterLabel={validLink?`${validLink.promoter.name} · ${validLink.label}`:undefined} guestFields={parseGuestFields(event.description)}/></main>;
}
