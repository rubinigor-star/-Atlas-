import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { GuestLinkManager } from "@/components/guest-link-manager";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { guestManagementToken } from "@/lib/guest-links";

export const dynamic="force-dynamic";

export default async function EventLinksPage({params}:{params:Promise<{id:string}>}){
 const{id}=await params;
 await requireEventAccess("EVENT_MANAGE",id);
 const event=await db.event.findUnique({where:{id},include:{categories:true,promoterLinks:{orderBy:{createdAt:"desc"},include:{promoter:true,category:true,table:true}},zones:{include:{tables:true}}}});
 if(!event)notFound();
 const tables=event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`,seats:item.seats,categoryId:item.categoryId})));
 const links=event.promoterLinks.map(item=>{const guest=item.promoter.name.startsWith("__GUEST_LIST__")||item.promoter.name.startsWith("__CHANNEL__:GUEST:");return{id:item.id,label:item.label,code:item.code,kind:guest?"GUEST" as const:"SALES" as const,allocation:item.table?`Стол ${item.table.label}`:item.category?`Категория ${item.category.name}`:"Все билеты",priceLabel:item.customPriceMinor===0?"0 ₪":item.customPriceMinor!=null?`${item.customPriceMinor/100} ₪`:"обычная цена",limit:item.guestLimit,publicPath:guest?`/g/${item.code}`:`/events/${event.slug}?channel=${item.code}`,managePath:guest?`/g/${item.code}?token=${guestManagementToken(item.id)}`:null}});
 return <AdminShell><div className="row between"><div><span className="eyebrow">Управление мероприятием</span><h1>Продажи и ссылки</h1><p className="muted">Гостевые списки, специальные цены и отдельные каналы продаж находятся здесь, отдельно от конструктора.</p></div><Link className="btn secondary" href={`/office/events/${event.id}`}>Вернуться к конструктору</Link></div><GuestLinkManager eventId={event.id} categories={event.categories.map(item=>({id:item.id,name:item.name,priceMinor:item.priceMinor}))} tables={tables} existingLinks={links}/></AdminShell>;
}
