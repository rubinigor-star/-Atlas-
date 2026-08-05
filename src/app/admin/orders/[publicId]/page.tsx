import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { eventDate, israelDateTime, money } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { TicketActions } from "@/components/ticket-actions";
import { ApprovalActions } from "@/components/approval-actions";
import { ResendTicketButton } from "@/components/resend-ticket-button";
import { OrderRefundManager } from "@/components/order-refund-manager";
import { requireEventAccess } from "@/lib/auth";

type AuthorizationRow = {
  id: string;
  provider: string;
  providerReference: string;
  cgUid: string | null;
  tranId: string | null;
  txId: string | null;
  status: string;
  amountMinor: number;
  refundedMinor: number;
  cardLast4: string | null;
  capturedAt: Date | null;
  voidedAt: Date | null;
  failureReason: string | null;
};

type RefundAttemptRow = {
  id: string;
  amountMinor: number;
  reason: string;
  status: string;
  refundTranId: string | null;
  hypResultCode: string | null;
  hypStatusText: string | null;
  failureReason: string | null;
  createdAt: Date;
  completedAt: Date | null;
};

type RefundRequestRow = {
  id: string;
  amountMinor: number;
  reason: string;
  status: string;
  createdAt: Date;
};

export const dynamic = "force-dynamic";

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    CAPTURED: "Оплачено",
    PARTIALLY_REFUNDED: "Частично возвращено",
    REFUNDED: "Полностью возвращено",
    FAILED: "Ошибка",
  };
  return labels[status] || status;
}

function refundStatusLabel(status: string) {
  const labels: Record<string, string> = {
    PENDING: "Обрабатывается",
    SUCCEEDED: "Подтверждено HYP",
    FAILED: "Отклонено",
    APPROVED: "Одобрено",
    REJECTED: "Отклонено",
  };
  return labels[status] || status;
}

export default async function OrderAdmin({ params, searchParams }: { params: Promise<{ publicId: string }>; searchParams: Promise<{ returnTo?: string }> }) {
  const { publicId } = await params;
  const query = await searchParams;
  const returnTo = query.returnTo?.startsWith("/office/") ? query.returnTo : "/office/orders";
  const order = await db.order.findUnique({ where: { publicId }, include: { event: true, items: true, tickets: { include: { category: true } } } });
  if (!order) notFound();

  const staff = await requireEventAccess("ORDER_VIEW", order.eventId);
  const canManage = staff.permissionSet.has("ORDER_MANAGE");

  const authorization = (await db.$queryRawUnsafe<AuthorizationRow[]>(
    `SELECT "id","provider","providerReference","cgUid","tranId","txId","status","amountMinor","refundedMinor","cardLast4","capturedAt","voidedAt","failureReason" FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`,
    order.id,
  ).catch(() => []))[0];

  const refundAttempts = authorization
    ? await db.$queryRawUnsafe<RefundAttemptRow[]>(
        `SELECT "id","amountMinor","reason","status","refundTranId","hypResultCode","hypStatusText","failureReason","createdAt","completedAt" FROM "RefundAttempt" WHERE "orderId"=$1 ORDER BY "createdAt" DESC`,
        order.id,
      ).catch(() => [])
    : [];

  const refundRequests = await db.$queryRawUnsafe<RefundRequestRow[]>(
    `SELECT "id","amountMinor","reason","status","createdAt" FROM "RefundRequest" WHERE "orderId"=$1 ORDER BY "createdAt" DESC`,
    order.id,
  ).catch(() => []);

  const refundableMinor = authorization ? Math.max(0, authorization.amountMinor - authorization.refundedMinor) : 0;
  const hasRefundIdentifier = Boolean(authorization?.cgUid || authorization?.tranId);
  const canExecuteRefund = Boolean(canManage && order.status === "PAID" && authorization?.provider === "HYP" && hasRefundIdentifier && refundableMinor > 0);
  const pendingRequest = refundRequests.find((request) => request.status === "PENDING");

  return <AdminShell>
    <Link className="btn secondary" href={returnTo}>← Вернуться</Link>
    <span className="eyebrow">{order.status === "PENDING_APPROVAL" ? "Заявка на вход" : "Заказ"}</span>
    <div className="row between"><h1>{order.publicId}</h1><span className="pill">{order.status}</span></div>

    <div className="stats">
      <div className="stat"><span className="muted">Сумма заказа</span><strong>{money(order.totalMinor)}</strong></div>
      <div className="stat"><span className="muted">Мероприятие</span><strong>{order.event.title}</strong><small>{eventDate(order.event.startsAt)}</small></div>
      <div className="stat"><span className="muted">Билеты</span><strong>{order.tickets.length}</strong></div>
    </div>

    <section className="panel form"><h2>Покупатель</h2><div className="form-grid two"><div><strong>{order.customerName}</strong><p>{order.customerEmail}<br/>{order.customerPhone}</p></div><div><strong>Данные заказа</strong><p>Создан: {israelDateTime(order.createdAt)}<br/>Статус: {order.status}</p></div></div></section>
    {order.eligibilityAnswer && <div className="panel" style={{ background: "#fff8e8" }}><strong>Ответ клиента</strong><p>{order.eligibilityAnswer}</p></div>}

    <section className="panel"><h2>Состав заказа</h2><div className="table-wrap"><table><thead><tr><th>Категория</th><th>Количество</th><th>Цена</th></tr></thead><tbody>{order.items.map(item => <tr key={item.id}><td>{item.categoryName}</td><td>{item.quantity}</td><td>{money(item.unitPriceMinor * item.quantity)}</td></tr>)}</tbody></table></div></section>

    <section className="panel form">
      <span className="eyebrow">Финансы</span>
      <h2>Платёж HYP</h2>
      {!authorization ? <div className="toast" style={{ background: "#fff8e8" }}>
        <strong>Платёжная транзакция не найдена</strong>
        <p style={{ marginBottom: 0 }}>Заказ отмечен как оплаченный, но отдельная запись HYP отсутствует. Это старая оплата, созданная до сохранения платёжных идентификаторов. Выполнять возврат по ней автоматически небезопасно. Для теста нужна новая оплата после текущего обновления.</p>
      </div> : <>
        <div className="stats" style={{ marginTop: 16 }}>
          <div className="stat"><span className="muted">Статус</span><strong>{paymentStatusLabel(authorization.status)}</strong></div>
          <div className="stat"><span className="muted">Оплачено</span><strong>{money(authorization.amountMinor)}</strong></div>
          <div className="stat"><span className="muted">Уже возвращено</span><strong>{money(authorization.refundedMinor)}</strong></div>
          <div className="stat"><span className="muted">Доступно к возврату</span><strong>{money(refundableMinor)}</strong></div>
        </div>
        <div className="form-grid two" style={{ marginTop: 18 }}>
          <div><strong>Данные транзакции</strong><p>Провайдер: {authorization.provider}<br/>Основная ссылка: {authorization.providerReference || "—"}<br/>Карта: {authorization.cardLast4 ? `•••• ${authorization.cardLast4}` : "—"}<br/>Оплачено: {authorization.capturedAt ? israelDateTime(authorization.capturedAt) : "—"}</p></div>
          <div><strong>Пригодность к возврату</strong><p>cgUid: {authorization.cgUid ? "сохранён" : "не найден"}<br/>tranId: {authorization.tranId ? "сохранён" : "не найден"}<br/>txId: {authorization.txId ? "сохранён" : "не найден"}<br/>Автоматический возврат: {hasRefundIdentifier ? "доступен" : "недоступен"}</p></div>
        </div>
        {!hasRefundIdentifier && <div className="toast" style={{ background: "#fff8e8" }}><strong>Эта оплата не готова к автоматическому возврату</strong><p style={{ marginBottom: 0 }}>HYP не сохранил cgUid или tranId. Не запускайте возврат по случайному providerReference. Создайте новую оплату для безопасного теста.</p></div>}
        {authorization.failureReason && <div className="toast">Ошибка платежа: {authorization.failureReason}</div>}
      </>}
    </section>

    {refundRequests.length > 0 && <section className="panel"><h2>Запросы клиента на возврат</h2><div className="table-wrap"><table><thead><tr><th>Дата</th><th>Сумма</th><th>Причина</th><th>Статус</th></tr></thead><tbody>{refundRequests.map(request => <tr key={request.id}><td>{israelDateTime(request.createdAt)}</td><td>{money(request.amountMinor)}</td><td>{request.reason}</td><td>{refundStatusLabel(request.status)}</td></tr>)}</tbody></table></div></section>}

    {canManage && order.status === "PAID" && <OrderRefundManager
      orderId={order.publicId}
      refundableMinor={refundableMinor}
      enabled={canExecuteRefund}
      disabledReason={!authorization ? "Платёжная транзакция HYP не найдена" : !hasRefundIdentifier ? "В оплате отсутствуют cgUid и tranId" : refundableMinor <= 0 ? "Вся сумма уже возвращена" : authorization.provider !== "HYP" ? "Возврат доступен только для HYP" : "Возврат недоступен"}
      requestId={pendingRequest?.id}
      suggestedAmountMinor={pendingRequest?.amountMinor}
      suggestedReason={pendingRequest?.reason}
    />}

    {refundAttempts.length > 0 && <section className="panel"><h2>История возвратов</h2><div className="table-wrap"><table><thead><tr><th>Дата</th><th>Сумма</th><th>Причина</th><th>Статус</th><th>HYP</th></tr></thead><tbody>{refundAttempts.map(attempt => <tr key={attempt.id}><td>{israelDateTime(attempt.completedAt || attempt.createdAt)}</td><td>{money(attempt.amountMinor)}</td><td>{attempt.reason}</td><td>{refundStatusLabel(attempt.status)}{attempt.failureReason ? <><br/><small>{attempt.failureReason}</small></> : null}</td><td>{attempt.refundTranId || attempt.hypResultCode || attempt.hypStatusText || "—"}</td></tr>)}</tbody></table></div></section>}

    {order.status === "PENDING_APPROVAL" && staff.permissionSet.has("REQUEST_REVIEW") && <><h2>Решение организатора</h2><ApprovalActions publicId={order.publicId} returnTo={returnTo}/></>}
    {order.reviewNote && <div className="toast">Комментарий: {order.reviewNote}</div>}
    {order.status === "PAID" && order.tickets.length > 0 && canManage && <div className="panel" style={{ marginTop: 20 }}><h2 style={{ marginTop: 0 }}>Отправка билетов</h2><p className="muted" style={{ marginBottom: 0 }}>Получатель: <strong>{order.customerEmail}</strong>. Письмо будет отправлено повторно со всеми билетами заказа и PDF-вложением.</p><ResendTicketButton publicId={order.publicId}/></div>}

    {order.tickets.length > 0 && <h2>Билеты</h2>}
    {order.tickets.map(ticket => <div className="panel row between" style={{ marginBottom: 12 }} key={ticket.id}><div><span className="pill">{ticket.status}</span><h3>{ticket.category.name}</h3><code>{ticket.publicCode}</code></div><div>{canManage && <TicketActions id={ticket.id} status={ticket.status}/>}<Link className="btn secondary" style={{ marginTop: 8 }} href={`/api/tickets/${ticket.id}/pdf`}>PDF</Link></div></div>)}
  </AdminShell>;
}
