import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { TicketActions } from "@/components/ticket-actions";
import { ApprovalActions } from "@/components/approval-actions";
import { ResendTicketButton } from "@/components/resend-ticket-button";
import { OrderRefundManager } from "@/components/order-refund-manager";
import { requireEventAccess } from "@/lib/auth";

type AuthorizationRow={provider:string;providerReference:string;status:string;amountMinor:number;cardLast4:string|null;capturedAt:Date|null;voidedAt:Date|null;failureReason:string|null};

export const dynamic = "force-dynamic";

export default async function OrderAdmin({
  params,
  searchParams,
}: {
  params: Promise<{ publicId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { publicId } = await params;
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/office/") ? query.returnTo : "/office/orders";
  const order = await db.order.findUnique({
    where: { publicId },
    include: { event: true, items: true, tickets: { include: { category: true } } },
  });
  if (!order) notFound();
  const staff = await requireEventAccess("ORDER_VIEW", order.eventId);
  const authorization=(await db.$queryRaw<AuthorizationRow[]>`SELECT provider,"providerReference",status,"amountMinor","cardLast4","capturedAt","voidedAt","failureReason" FROM "PaymentAuthorization" WHERE "orderId"=${order.id} LIMIT 1`)[0];
  const canRefund=staff.permissionSet.has("ORDER_MANAGE");
  const refunded=authorization?.status==="REFUNDED"||authorization?.status==="PARTIALLY_REFUNDED"||order.status==="CANCELLED";

  return (
    <AdminShell>
      <Link className="btn secondary" href={returnTo}>← Вернуться</Link>
      <span className="eyebrow">{order.status === "PENDING_APPROVAL" ? "Заявка на вход" : "Order"}</span>
      <div className="row between"><h1>{order.publicId}</h1><span className="pill">{order.status}</span></div>

      <div className="stats">
        <div className="stat"><span className="muted">Сумма</span><strong>{money(order.totalMinor)}</strong></div>
        <div className="stat"><span className="muted">Мероприятие</span><strong>{order.event.title}</strong><small>{eventDate(order.event.startsAt)}</small></div>
        <div className="stat"><span className="muted">Билеты</span><strong>{order.tickets.length}</strong></div>
      </div>

      <section className="panel form"><h2>Покупатель</h2><div className="form-grid two"><div><strong>{order.customerName}</strong><p>{order.customerEmail}<br/>{order.customerPhone}</p></div><div><strong>Данные заказа</strong><p>Создан: {new Date(order.createdAt).toLocaleString("ru-IL")}<br/>Статус: {order.status}</p></div></div></section>

      {order.eligibilityAnswer && <div className="panel" style={{ background: "#fff8e8" }}><strong>Ответ клиента</strong><p>{order.eligibilityAnswer}</p></div>}

      <section className="panel"><h2>Состав заказа</h2><div className="table-wrap"><table><thead><tr><th>Категория</th><th>Количество</th><th>Цена</th></tr></thead><tbody>{order.items.map(item=><tr key={item.id}><td>{item.categoryName}</td><td>{item.quantity}</td><td>{money(item.unitPriceMinor*item.quantity)}</td></tr>)}</tbody></table></div></section>

      <section className="panel form"><h2>Платёж</h2>{authorization?<div className="form-grid two"><div><strong>{authorization.provider}</strong><p>Статус: {authorization.status}<br/>Транзакция: {authorization.providerReference}<br/>Карта: {authorization.cardLast4?`•••• ${authorization.cardLast4}`:"—"}</p></div><div><strong>{money(authorization.amountMinor)}</strong><p>{authorization.capturedAt?`Оплачено: ${new Date(authorization.capturedAt).toLocaleString("ru-IL")}`:""}{authorization.voidedAt?<><br/>Возврат: {new Date(authorization.voidedAt).toLocaleString("ru-IL")}</>:null}{authorization.failureReason?<><br/>Причина: {authorization.failureReason}</>:null}</p></div></div>:<div className="toast">Платёжная транзакция не найдена.</div>}</section>

      {order.status === "PENDING_APPROVAL" && staff.permissionSet.has("REQUEST_REVIEW") && <><h2>Решение организатора</h2><ApprovalActions publicId={order.publicId} returnTo={returnTo} /></>}
      {order.reviewNote && <div className="toast">Комментарий: {order.reviewNote}</div>}

      {order.status === "PAID" && order.tickets.length > 0 && canRefund && <div className="panel" style={{ marginTop: 20 }}><h2 style={{ marginTop: 0 }}>Отправка билетов</h2><p className="muted" style={{ marginBottom: 0 }}>Получатель: <strong>{order.customerEmail}</strong>. Письмо будет отправлено повторно со всеми билетами заказа и PDF-вложением.</p><ResendTicketButton publicId={order.publicId} /></div>}

      {canRefund&&order.status==="PAID"&&authorization?.provider==="HYP"&&<OrderRefundManager orderId={order.publicId} totalMinor={order.totalMinor} alreadyRefunded={refunded}/>} 

      {order.tickets.length > 0 && <h2>Билеты</h2>}
      {order.tickets.map((ticket) => <div className="panel row between" style={{ marginBottom: 12 }} key={ticket.id}><div><span className="pill">{ticket.status}</span><h3>{ticket.category.name}</h3><code>{ticket.publicCode}</code></div><div>{canRefund && <TicketActions id={ticket.id} status={ticket.status} />}<Link className="btn secondary" style={{ marginTop: 8 }} href={`/api/tickets/${ticket.id}/pdf`}>PDF</Link></div></div>)}
    </AdminShell>
  );
}
