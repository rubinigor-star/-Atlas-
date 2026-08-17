import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { GuestListDetailManager } from "@/components/guest-list-detail-manager";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGuestLinkSettings, guestManagementToken, isGuestListPromoter } from "@/lib/guest-links";

export const dynamic="force-dynamic";

export default async function GuestListDetailPage({params}:{params:Promise<{id:string}>}){
 const staff=await requirePermission("EVENT_MANAGE");const {id}=await params;
 const list=await db.promoterLink.findFirst({where:{id,event:{organizationId:staff.organizationId!}},include:{promoter:true,event:true,category:true,table:true,visits:{select:{id:true}},orders:{where:{status:{notIn:["CANCELLED","REJECTED"]}},orderBy:{createdAt:"desc"},include:{items:true,tickets:true}}}});
 if(!list||!isGuestListPromoter(list.promoter.name))notFound();
 if(staff.eventAccess.length&&!staff.eventAccess.some(item=>item.eventId===list.eventId))notFound();
 const settings=await getGuestLinkSettings(list.id);
 const guests=list.orders.reduce((sum,order)=>sum+order.items.reduce((s,item)=>s+item.quantity,0),0);
 const checkins=list.orders.flatMap(order=>order.tickets).filter(ticket=>ticket.status==="USED").length;
 const limit=settings.seatIds.length?settings.seatIds.length:list.guestLimit??list.table?.seats??list.category?.capacity??Math.max(guests,1);
 const remaining=Math.max(limit-guests,0);
 const fill=limit?Math.min(100,Math.round(guests/limit*100)):null;
 const allocation=settings.seatIds.length?`${settings.seatIds.length} мест с карты`:list.table?`Стол: ${list.table.label}`:list.category?`Билет: ${list.category.name}`:"Всё мероприятие";
 const publicPath=`/g/${list.code}`;const managePath=`${publicPath}?token=${guestManagementToken(list.id)}`;
 return <AdminShell>
  <div className="office-page-heading"><div><Link href="/office/guest-lists">← Гостевые ссылки</Link><span className="eyebrow">Guest link</span><h1>{list.label}</h1><p className="muted">{list.event.title} · {allocation}</p></div><span className="pill" style={list.active?{background:"#dcfae6",color:"#067647"}:{}}>{list.active?"Активна":"Отключена"}</span></div>
  <div className="stats"><div className="stat"><span className="muted">Гостей</span><strong>{guests}</strong><small>из {limit}</small></div><div className="stat"><span className="muted">Осталось мест</span><strong>{remaining}</strong><small>{fill!==null?`${fill}% заполнено`:""}</small></div><div className="stat"><span className="muted">Прошли</span><strong>{checkins}</strong><small>{guests?`${Math.round(checkins/guests*100)}% гостей`:"0%"}</small></div><div className="stat"><span className="muted">Уникальные открытия</span><strong>{list.visits.length}</strong><small>публичной ссылки</small></div><div className="stat"><span className="muted">Заказов</span><strong>{list.orders.length}</strong><small>активных</small></div></div>
  <div className="panel" style={{marginTop:24}}><span className="eyebrow">Состояние</span><h2 style={{marginBottom:8}}>Заполнение ссылки</h2><p className="muted">{guests} из {limit} мест занято.</p>{fill!==null&&<div style={{height:10,borderRadius:999,background:"#eaecf0",overflow:"hidden"}}><div style={{height:"100%",width:`${fill}%`,background:"#12b76a"}}/></div>}</div>
  <div style={{marginTop:24}}><GuestListDetailManager list={{id:list.id,label:list.label,active:list.active,publicPath,managePath,guestLimit:limit,maxPerOrder:list.maxPerOrder,showAttendees:settings.showAttendees,seatPoolLocked:settings.seatIds.length>0,startsAt:list.startsAt?.toISOString()??null,endsAt:list.endsAt?.toISOString()??null}} guests={list.orders.map(order=>({id:order.id,publicId:order.publicId,name:order.customerName,email:order.customerEmail,phone:order.customerPhone,tickets:order.tickets.length,used:order.tickets.filter(ticket=>ticket.status==="USED").length}))}/></div>
 </AdminShell>
}
