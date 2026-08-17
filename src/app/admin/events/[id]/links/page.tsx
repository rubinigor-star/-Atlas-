import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { GuestLinkManager } from "@/components/guest-link-manager";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { getGuestLinkSettings, guestManagementToken, isGuestListPromoter } from "@/lib/guest-links";

export const dynamic="force-dynamic";

export default async function EventLinksPage({params}:{params:Promise<{id:string}>}){
 const{id}=await params;
 await requireEventAccess("EVENT_MANAGE",id);
 const event=await db.event.findUnique({where:{id},include:{categories:true,promoterLinks:{orderBy:{createdAt:"desc"},include:{promoter:true,category:true,table:true,orders:{where:{status:{notIn:["CANCELLED","REJECTED"]}},include:{items:true}}}},zones:{include:{tables:{include:{seatItems:true}}}}}});
 if(!event)notFound();
 const tables=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,seats:item.seats,categoryId:item.categoryId})));
 const mapObjects=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,objectType:item.objectType,priceMode:item.priceMode,x:item.x,y:item.y,width:item.width,height:item.height,rotation:item.rotation,seats:item.seats,categoryId:item.categoryId,reserved:item.reserved,seatItems:item.seatItems.map(seat=>({id:seat.id,label:seat.label,position:seat.position,status:seat.status,categoryId:seat.categoryId}))})));
 const guestLinks=event.promoterLinks.filter(item=>isGuestListPromoter(item.promoter.name));
 const links=await Promise.all(guestLinks.map(async item=>{
   const settings=await getGuestLinkSettings(item.id);
   const used=item.orders.flatMap(order=>order.items).reduce((sum,orderItem)=>sum+orderItem.quantity,0);
   return {id:item.id,label:item.label,code:item.code,active:item.active,allocation:settings.seatIds.length?`${settings.seatIds.length} мест с карты`:item.table?`Стол ${item.table.label}`:item.category?`Категория ${item.category.name}`:"Все билеты",priceLabel:item.customPriceMinor===0?"Бесплатно":item.customPriceMinor!=null?`${item.customPriceMinor/100} ₪`:"Обычная цена",limit:item.guestLimit??0,used,maxPerOrder:item.maxPerOrder,showAttendees:settings.showAttendees,startsAt:item.startsAt?.toISOString()??null,endsAt:item.endsAt?.toISOString()??null,publicPath:`/g/${item.code}`,managePath:`/g/${item.code}?token=${guestManagementToken(item.id)}`};
 }));
 return <AdminShell><div className="row between"><div><span className="eyebrow">Управление мероприятием</span><h1>Гостевые ссылки</h1><p className="muted">Создание и управление персональными гостевыми ссылками. Продажи через промоутеров управляются отдельно и здесь не отображаются.</p></div><Link className="btn secondary" href={`/office/events/${event.id}`}>Вернуться к мероприятию</Link></div><GuestLinkManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor}))} tables={tables} mapObjects={mapObjects} existingLinks={links}/></AdminShell>;
}
