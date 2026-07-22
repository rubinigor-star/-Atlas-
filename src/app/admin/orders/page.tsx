import Link from "next/link";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";

export const dynamic="force-dynamic";
export default async function Orders(){const staff=await requirePermission("ORDER_VIEW");const eventIds=staff.eventAccess.map(item=>item.eventId);const orders=await db.order.findMany({where:{event:{organizationId:staff.organizationId!},...(eventIds.length?{eventId:{in:eventIds}}:{})},include:{event:true,tickets:true},orderBy:{createdAt:"desc"}});return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>Заказы</h1><p>Оплаченные заказы, заявки и выпущенные билеты.</p></div></div><div className="table-wrap"><table><thead><tr><th>Номер</th><th>Событие</th><th>Клиент</th><th>Билетов</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><Link href={`/office/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td>{order.event.title}</td><td>{order.customerName}</td><td>{order.tickets.length}</td><td>{money(order.totalMinor)}</td><td><span className="pill">{order.status}</span></td></tr>)}</tbody></table></div></AdminShell>}
