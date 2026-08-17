import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { GuestListPage } from "@/components/guest-list-page";
import { getGuestLinkSettings, isGuestListPromoter, verifyGuestManagementToken } from "@/lib/guest-links";
import { parseGuestFields } from "@/lib/event-guest-fields";

export const dynamic="force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

export default async function GuestPage({params,searchParams}:{params:Promise<{code:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const {code}=await params;const query=await searchParams;
  const link=await db.promoterLink.findUnique({where:{code:code.toUpperCase()},include:{promoter:true,event:{include:{categories:true}},category:true,table:true,orders:{where:{status:{in:["PAID","PENDING_APPROVAL"]}},orderBy:{createdAt:"asc"},include:{items:true,tickets:true}}}});
  const now=new Date();
  if(!link||!link.active||!isGuestListPromoter(link.promoter.name)||(link.startsAt&&link.startsAt>now)||(link.endsAt&&link.endsAt<now))notFound();
  const token=query.token||"";const canManage=verifyGuestManagementToken(link.id,token);const settings=await getGuestLinkSettings(link.id);const limit=link.guestLimit??link.table?.seats??link.category?.capacity??0;
  const guestCount=link.orders.reduce((sum,order)=>sum+order.items.reduce((n,item)=>n+item.quantity,0),0);
  const showRoster=canManage||settings.showAttendees;
  const guests=showRoster?link.orders.map(order=>({id:order.id,name:order.customerName,phone:canManage?order.customerPhone:null,ticketStatus:order.status==="PENDING_APPROVAL"?"PENDING_APPROVAL":order.tickets[0]?.status??order.status})):[];
  let poolSeat:null|{id:string;categoryId:string;label:string}=null;
  if(settings.seatIds.length){
    const seats=await db.seat.findMany({where:{id:{in:settings.seatIds},status:"AVAILABLE"},include:{table:true},orderBy:{position:"asc"}});
    const claims=await db.$queryRawUnsafe<Array<{seatId:string|null}>>(`SELECT "seatId" FROM "ReservationClaim" WHERE "seatId" = ANY($1::text[])`,settings.seatIds).catch(()=>[]);
    const claimed=new Set(claims.map(item=>item.seatId).filter((id):id is string=>Boolean(id)));
    const candidate=seats.find(seat=>!claimed.has(seat.id)&&Boolean(seat.categoryId??seat.table.categoryId));
    if(candidate)poolSeat={id:candidate.id,categoryId:(candidate.categoryId??candidate.table.categoryId)!,label:`${candidate.table.label} · ${candidate.label}`};
  }
  const checkoutCategory=poolSeat?link.event.categories.find(item=>item.id===poolSeat?.categoryId)??null:link.category??(link.table?.categoryId?link.event.categories.find(item=>item.id===link.table?.categoryId):null)??link.event.categories.find(item=>!item.hidden)??null;
  const effectivePrice=link.customPriceMinor??checkoutCategory?.priceMinor??0;
  const allocation=settings.seatIds.length?`Выбранные места с карты${poolSeat?` · следующее: ${poolSeat.label}`:""}`:link.table?`Стол ${link.table.label}`:link.category?`Билет: ${link.category.name}`:"Гостевой список";
  return <GuestListPage code={link.code} token={token} title={link.label} eventTitle={link.event.title} eventId={link.eventId} categoryId={checkoutCategory?.id??null} seatId={poolSeat?.id??null} requiresPayment={effectivePrice>0} allocation={allocation} limit={limit} guestCount={guestCount} canManage={canManage} showAttendees={settings.showAttendees} fields={parseGuestFields(link.event.description)} guests={guests}/>;
}
