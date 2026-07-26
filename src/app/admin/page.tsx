import Link from "next/link";
import { db } from "@/lib/db";
import { money, eventDate } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { RequestInbox } from "@/components/request-inbox";
import { OrderStatusControl } from "@/components/order-status-control";
import { ExcelExportButton } from "@/components/excel-export-button";
import { requirePermission, canAccessEvent } from "@/lib/auth";

export const dynamic = "force-dynamic";

const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";

export default async function Admin() {
  const staff=await requirePermission("EVENT_VIEW");
  const [events, orders, revenue, approvalQueue] = await Promise.all([
    db.event.findMany({ where:{organizationId:staff.organizationId!},include: { venue: true, categories: true }, orderBy: { startsAt: "asc" } }),
    db.order.findMany({ where:{event:{organizationId:staff.organizationId!}},take: 6, orderBy: { createdAt: "desc" }, include: { event: true, tickets: true } }),
    db.order.aggregate({ _sum: { totalMinor: true }, where: { status: "PAID",event:{organizationId:staff.organizationId!} } }),
    db.order.findMany({where:{status:{in:["PENDING_APPROVAL","AWAITING_PAYMENT","PAID","REJECTED","CANCELLED"]},event:{organizationId:staff.organizationId!},OR:[{reviewNote:null},{reviewNote:{not:DISMISSED_EXPIRED_NOTE}}]},take:30,orderBy:{createdAt:"desc"},include:{event:true,items:true,guest:{include:{orders:{include:{tickets:{include:{scans:true}}}}}}}}),
  ]);
  const visibleEvents=events.filter((event)=>canAccessEvent(staff,event.id));
  const queue=approvalQueue.map((request)=>{
    const previous=request.guest?.orders.filter(order=>order.id!==request.id)??[];
    const visits=previous.flatMap(order=>order.tickets).filter(ticket=>ticket.scans.length>0).length;
    return {id:request.id,publicId:request.publicId,customerName:request.customerName,customerEmail:request.customerEmail,customerPhone:request.customerPhone,birthDate:request.customerBirthDate?.toISOString()??request.guest?.birthDate.toISOString()??null,city:request.customerCity??request.guest?.city??null,facebook:request.customerFacebook??request.guest?.facebook??null,instagram:request.customerInstagram??request.guest?.instagram??null,guestStatus:request.guest?.status??null,previousOrders:previous.length,previousVisits:visits,answer:request.eligibilityAnswer,status:request.status,eventTitle:request.event.title,eventDate:request.event.startsAt.toISOString(),createdAt:request.createdAt.toISOString(),expiresAt:request.event.startsAt.toISOString(),inactive:false,totalMinor:request.totalMinor,items:request.items.map(item=>({name:item.categoryName,quantity:item.quantity}))};
  });
  const eventRows=visibleEvents.map(event=>({"Мероприятие":event.title,"Площадка":event.venue.name,"Дата":eventDate(event.startsAt),"Режим продажи":event.salesMode==="INSTANT"?"Автоматически":"По одобрению","Продано":event.categories.reduce((sum,category)=>sum+category.sold,0),"Вместимость":event.categories.reduce((sum,category)=>sum+category.capacity,0)}));
  const orderRows=orders.map(order=>({"Номер заказа":order.publicId,"Мероприятие":order.event.title,"Покупатель":order.customerName,"Email":order.customerEmail,"Билетов":order.tickets.length,"Сумма":money(order.totalMinor),"Статус":order.status}));

  return <AdminShell>
    <div className="row between"><div><span className="eyebrow">Organizer back-office</span><h1>Панель управления</h1></div>{staff.permissionSet.has("EVENT_MANAGE")&&<Link href="/office/events/new" className="btn">+ Новое событие</Link>}</div>
    <div className="stats"><div className="stat"><span className="muted">Продажи</span><strong>{money(revenue._sum.totalMinor ?? 0)}</strong></div><div className="stat"><span className="muted">Последние заказы</span><strong>{orders.length}</strong></div><div className="stat"><span className="muted">Новые заявки</span><strong>{queue.filter(item=>item.status==="PENDING_APPROVAL").length}</strong></div></div>
    {staff.permissionSet.has("REQUEST_REVIEW")&&<><div className="row between"><h2 className="section-title">Очередь заявок</h2><Link href="/office/requests">Полный список →</Link></div><RequestInbox initialRequests={queue} compact/></>}
    <div className="row between"><h2 className="section-title">Мероприятия</h2><div className="row"><ExcelExportButton rows={eventRows} filename="atlas-events"/><Link href="/office/events">Все мероприятия →</Link></div></div>
    <div className="table-wrap"><table><thead><tr><th>Событие</th><th>Дата</th><th>Режим продажи</th><th>Продано</th><th></th></tr></thead><tbody>{visibleEvents.map(event=><tr key={event.id}><td><Link href={`/office/events/${event.id}`}><strong>{event.title}</strong></Link><br/><small>{event.venue.name}</small></td><td>{eventDate(event.startsAt)}</td><td><span className="pill">{event.salesMode==="INSTANT"?"Автоматически":"По одобрению"}</span></td><td>{event.categories.reduce((sum,category)=>sum+category.sold,0)} / {event.categories.reduce((sum,category)=>sum+category.capacity,0)}</td><td><Link className="btn secondary" href={`/office/events/${event.id}`}>{staff.permissionSet.has("EVENT_MANAGE")?"Управлять":"Открыть"}</Link></td></tr>)}</tbody></table></div>
    {staff.permissionSet.has("ORDER_VIEW")&&<><div className="row between"><h2 className="section-title">Последние заказы</h2><div className="row"><ExcelExportButton rows={orderRows} filename="atlas-latest-orders"/><Link href="/office/orders">Все →</Link></div></div><div className="table-wrap"><table><thead><tr><th>Номер</th><th>Мероприятие</th><th>Покупатель</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><Link href={`/office/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td><strong>{order.event.title}</strong><br/><small>{eventDate(order.event.startsAt)}</small></td><td>{order.customerName}<br/><small>{order.customerEmail}</small></td><td>{money(order.totalMinor)}</td><td><OrderStatusControl publicId={order.publicId} initialStatus={order.status} canReview={staff.permissionSet.has("REQUEST_REVIEW")} /></td></tr>)}</tbody></table></div></>}
  </AdminShell>;
}
