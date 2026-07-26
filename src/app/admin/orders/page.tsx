import Link from "next/link";
import { db } from "@/lib/db";
import { money, eventDate } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { ExcelExportButton } from "@/components/excel-export-button";

export const dynamic="force-dynamic";

export default async function Orders(){
  const staff=await requirePermission("ORDER_VIEW");
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const orders=await db.order.findMany({where:{event:{organizationId:staff.organizationId!},...(eventIds.length?{eventId:{in:eventIds}}:{})},include:{event:true,tickets:true},orderBy:{createdAt:"desc"}});
  const rows=orders.map(order=>({"Номер заказа":order.publicId,"Мероприятие":order.event.title,"Дата мероприятия":eventDate(order.event.startsAt),"Клиент":order.customerName,"Email":order.customerEmail,"Телефон":order.customerPhone,"Билетов":order.tickets.length,"Сумма":money(order.totalMinor),"Статус":order.status,"Дата заказа":new Date(order.createdAt).toLocaleString("ru-IL")}));
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>Заказы</h1><p>Оплаченные заказы, заявки и выпущенные билеты.</p></div><ExcelExportButton rows={rows} filename="atlas-orders"/></div><div className="table-wrap"><table><thead><tr><th>Номер</th><th>Событие</th><th>Клиент</th><th>Билетов</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><Link href={`/office/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td><strong>{order.event.title}</strong><br/><small>{eventDate(order.event.startsAt)}</small></td><td>{order.customerName}<br/><small>{order.customerEmail}</small></td><td>{order.tickets.length}</td><td>{money(order.totalMinor)}</td><td><span className="pill">{order.status}</span></td></tr>)}</tbody></table></div></AdminShell>;
}
