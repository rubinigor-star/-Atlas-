import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { GuestListDetailManager } from "@/components/guest-list-detail-manager";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { guestManagementToken, isGuestListPromoter } from "@/lib/guest-links";

export const dynamic="force-dynamic";
const PUBLIC_ORIGIN="https://www.atlas-one.co";

export default async function GuestListDetailPage({params}:{params:Promise<{id:string}>}){
 const staff=await requirePermission("EVENT_MANAGE");const {id}=await params;
 const list=await db.promoterLink.findFirst({where:{id,event:{organizationId:staff.organizationId!}},include:{promoter:true,event:true,category:true,table:true,visits:{select:{id:true}},orders:{where:{status:{notIn:["CANCELLED","REJECTED"]}},orderBy:{createdAt:"desc"},include:{items:true,tickets:true}}}});
 if(!list||!isGuestListPromoter(list.promoter.name))notFound();
 if(staff.eventAccess.length&&!staff.eventAccess.some(item=>item.eventId===list.eventId))notFound();
 const guests=list.orders.reduce((sum,order)=>sum+order.items.reduce((s,item)=>s+item.quantity,0),0);
 const checkins=list.orders.flatMap(order=>order.tickets).filter(ticket=>ticket.status==="USED").length;
 const limit=list.guestLimit??list.table?.seats??list.category?.capacity??null;
 const remaining=limit===null?null:Math.max(limit-guests,0);
 const fill=limit?Math.min(100,Math.round(guests/limit*100)):null;
 const allocation=list.table?`Стол: ${list.table.label}`:list.category?`Билет: ${list.category.name}`:"Всё мероприятие";
 const publicUrl=`${PUBLIC_ORIGIN}/g/${list.code}`;const manageUrl=`${publicUrl}?token=${guestManagementToken(list.id)}`;
 return <AdminShell>
  <div className="office-page-heading"><div><Link href="/office/guest-lists">← Гостевые списки</Link><span className="eyebrow">Guest list</span><h1>{list.label}</h1><p className="muted">{list.event.title} · {allocation}</p></div><span className="pill" style={list.active?{background:"#dcfae6",color:"#067647"}:{}}>{list.active?"Активен":"Отключён"}</span></div>
  <div className="stats"><div className="stat"><span className="muted">Гостей</span><strong>{guests}</strong><small>{limit?`из ${limit}`:"без лимита"}</small></div><div className="stat"><span className="muted">Осталось мест</span><strong>{remaining??"∞"}</strong><small>{fill!==null?`${fill}% заполнено`:""}</small></div><div className="stat"><span className="muted">Прошли</span><strong>{checkins}</strong><small>{guests?`${Math.round(checkins/guests*100)}% гостей`:"0%"}</small></div><div className="stat"><span className="muted">Уникальные открытия</span><strong>{list.visits.length}</strong><small>публичной ссылки</small></div><div className="stat"><span className="muted">Заказов</span><strong>{list.orders.length}</strong><small>активных</small></div></div>
  <div className="panel" style={{marginTop:24}}><span className="eyebrow">Состояние</span><h2 style={{marginBottom:8}}>Заполнение списка</h2><p className="muted">{limit?`${guests} из ${limit} мест занято.`:`Для списка не задан общий лимит.`}</p>{fill!==null&&<div style={{height:10,borderRadius:999,background:"#eaecf0",overflow:"hidden"}}><div style={{height:"100%",width:`${fill}%`,background:"#12b76a"}}/></div>}</div>
  <div style={{marginTop:24}}><GuestListDetailManager list={{id:list.id,label:list.label,active:list.active,publicUrl,manageUrl,guestLimit:list.guestLimit,maxPerOrder:list.maxPerOrder,startsAt:list.startsAt?.toISOString()??null,endsAt:list.endsAt?.toISOString()??null}} guests={list.orders.map(order=>({id:order.id,publicId:order.publicId,name:order.customerName,email:order.customerEmail,phone:order.customerPhone,tickets:order.tickets.length,used:order.tickets.filter(ticket=>ticket.status==="USED").length}))}/></div>
 </AdminShell>
}
