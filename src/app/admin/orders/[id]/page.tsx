import { notFound } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { OrderRefundManager } from "@/components/order-refund-manager";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { money,eventDate } from "@/lib/format";

type AuthorizationRow={provider:string;providerReference:string;status:string;amountMinor:number;cardLast4:string|null;capturedAt:Date|null;voidedAt:Date|null;failureReason:string|null};
export const dynamic="force-dynamic";
export default async function OrderPage({params}:{params:Promise<{id:string}>}){
 const actor=await requirePermission("ORDER_VIEW");const{id}=await params;
 const order=await db.order.findUnique({where:{publicId:id},include:{event:true,items:true,tickets:true}});if(!order||order.event.organizationId!==actor.organizationId)notFound();
 const authorization=(await db.$queryRaw<AuthorizationRow[]>`SELECT provider,"providerReference",status,"amountMinor","cardLast4","capturedAt","voidedAt","failureReason" FROM "PaymentAuthorization" WHERE "orderId"=${order.id} LIMIT 1`)[0];
 const canRefund=actor.permissionSet.has("ORDER_MANAGE");const refunded=authorization?.status==="REFUNDED"||authorization?.status==="PARTIALLY_REFUNDED"||order.status==="CANCELLED";
 return <AdminShell><div className="row between"><div><span className="eyebrow">Order</span><h1>{order.publicId}</h1><p><Link href="/office/orders">← Все заказы</Link></p></div><span className="pill">{order.status}</span></div>
 <div className="stats"><div className="stat"><span className="muted">Сумма</span><strong>{money(order.totalMinor)}</strong></div><div className="stat"><span className="muted">Мероприятие</span><strong>{order.event.title}</strong><small>{eventDate(order.event.startsAt)}</small></div><div className="stat"><span className="muted">Билеты</span><strong>{order.tickets.length}</strong></div></div>
 <section className="panel form"><h2>Покупатель</h2><div className="form-grid two"><div><strong>{order.customerName}</strong><p>{order.customerEmail}<br/>{order.customerPhone}</p></div><div><strong>Данные заказа</strong><p>Создан: {new Date(order.createdAt).toLocaleString("ru-IL")}<br/>Статус: {order.status}</p></div></div></section>
 <section className="panel"><h2>Состав заказа</h2><div className="table-wrap"><table><thead><tr><th>Категория</th><th>Количество</th><th>Цена</th></tr></thead><tbody>{order.items.map(item=><tr key={item.id}><td>{item.categoryName}</td><td>{item.quantity}</td><td>{money(item.unitPriceMinor*item.quantity)}</td></tr>)}</tbody></table></div></section>
 <section className="panel form"><h2>Платёж</h2>{authorization?<div className="form-grid two"><div><strong>{authorization.provider}</strong><p>Статус: {authorization.status}<br/>Транзакция: {authorization.providerReference}<br/>Карта: {authorization.cardLast4?`•••• ${authorization.cardLast4}`:"—"}</p></div><div><strong>{money(authorization.amountMinor)}</strong><p>{authorization.capturedAt?`Оплачено: ${new Date(authorization.capturedAt).toLocaleString("ru-IL")}`:""}{authorization.voidedAt?<><br/>Возврат: {new Date(authorization.voidedAt).toLocaleString("ru-IL")}</>:null}{authorization.failureReason?<><br/>Причина: {authorization.failureReason}</>:null}</p></div></div>:<div className="toast">Платёжная транзакция не найдена.</div>}</section>
 {canRefund&&order.status==="PAID"&&authorization?.provider==="HYP"&&<OrderRefundManager orderId={order.publicId} totalMinor={order.totalMinor} alreadyRefunded={refunded}/>} 
 </AdminShell>;
}
