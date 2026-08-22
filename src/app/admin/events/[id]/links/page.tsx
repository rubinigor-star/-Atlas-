import Link from "next/link";
import {notFound} from "next/navigation";
import {AdminShell} from "@/components/admin-shell";
import {GuestLinkManager} from "@/components/guest-link-manager";
import {db} from "@/lib/db";
import {requireEventAccess} from "@/lib/auth";
import {resolveStaffLocale} from "@/lib/i18n";
import {getGuestLinkSettings,guestManagementToken,isGuestListPromoter} from "@/lib/guest-links";

export const dynamic="force-dynamic";
const copy={
 ru:{eyebrow:"Управление мероприятием",title:"Гостевые ссылки",help:"Создание и управление персональными гостевыми ссылками. Продажи через промоутеров управляются отдельно и здесь не отображаются.",back:"Вернуться к мероприятию",seats:(n:number)=>`${n} мест с карты`,table:(v:string)=>`Стол ${v}`,category:(v:string)=>`Категория ${v}`,all:"Все билеты",free:"Бесплатно",regular:"Обычная цена"},
 he:{eyebrow:"ניהול אירוע",title:"קישורי אורחים",help:"יצירה וניהול של קישורי אורחים אישיים. מכירות דרך מקדמים מנוהלות בנפרד ואינן מוצגות כאן.",back:"חזרה לאירוע",seats:(n:number)=>`${n} מקומות מהמפה`,table:(v:string)=>`שולחן ${v}`,category:(v:string)=>`קטגוריה ${v}`,all:"כל הכרטיסים",free:"חינם",regular:"מחיר רגיל"},
 en:{eyebrow:"Event management",title:"Guest links",help:"Create and manage personal guest links. Promoter sales are managed separately and are not shown here.",back:"Back to event",seats:(n:number)=>`${n} seats from map`,table:(v:string)=>`Table ${v}`,category:(v:string)=>`Category ${v}`,all:"All tickets",free:"Free",regular:"Regular price"}
} as const;
export default async function EventLinksPage({params}:{params:Promise<{id:string}>}){
 const{id}=await params;const staff=await requireEventAccess("EVENT_MANAGE",id);const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});const text=copy[locale];
 const event=await db.event.findUnique({where:{id},include:{categories:true,promoterLinks:{orderBy:{createdAt:"desc"},include:{promoter:true,category:true,table:true,orders:{where:{status:{notIn:["CANCELLED","REJECTED"]}},include:{items:true}}}},zones:{include:{tables:{include:{seatItems:true}}}}}});if(!event)notFound();
 const tables=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,seats:item.seats,categoryId:item.categoryId})));const mapObjects=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,objectType:item.objectType,priceMode:item.priceMode,x:item.x,y:item.y,width:item.width,height:item.height,rotation:item.rotation,seats:item.seats,categoryId:item.categoryId,reserved:item.reserved,seatItems:item.seatItems.map(seat=>({id:seat.id,label:seat.label,position:seat.position,status:seat.status,categoryId:seat.categoryId}))})));const guestLinks=event.promoterLinks.filter(item=>isGuestListPromoter(item.promoter.name));
 const links=await Promise.all(guestLinks.map(async item=>{const settings=await getGuestLinkSettings(item.id);const used=item.orders.flatMap(order=>order.items).reduce((sum,orderItem)=>sum+orderItem.quantity,0);return{id:item.id,label:item.label,code:item.code,active:item.active,allocation:settings.seatIds.length?text.seats(settings.seatIds.length):item.table?text.table(item.table.label):item.category?text.category(item.category.name):text.all,priceLabel:item.customPriceMinor===0?text.free:item.customPriceMinor!=null?`${item.customPriceMinor/100} ₪`:text.regular,limit:item.guestLimit??0,used,maxPerOrder:item.maxPerOrder,showAttendees:settings.showAttendees,startsAt:item.startsAt?.toISOString()??null,endsAt:item.endsAt?.toISOString()??null,publicPath:`/g/${item.code}`,managePath:`/g/${item.code}?token=${guestManagementToken(item.id)}`};}));
 return <AdminShell><div className="row between"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p className="muted">{text.help}</p></div><Link className="btn secondary" href={`/office/events/${event.id}`}>{text.back}</Link></div><GuestLinkManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor}))} tables={tables} mapObjects={mapObjects} existingLinks={links}/></AdminShell>;
}
