import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { TicketActions } from "@/components/ticket-actions";
import { ApprovalActions } from "@/components/approval-actions";
import { ResendTicketButton } from "@/components/resend-ticket-button";
import { requireEventAccess } from "@/lib/auth";

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
  const returnTo = query.returnTo?.startsWith("/office/") ? query.returnTo : "/office/requests";
  const order = await db.order.findUnique({
    where: { publicId },
    include: { event: true, items: true, tickets: { include: { category: true } } },
  });
  if (!order) notFound();
  const staff = await requireEventAccess("ORDER_VIEW", order.eventId);

  return (
    <AdminShell>
      <Link className="btn secondary" href={returnTo}>
        ← Вернуться к очереди
      </Link>
      <span className="eyebrow">{order.status === "PENDING_APPROVAL" ? "Заявка на вход" : "Order"}</span>
      <div className="row between">
        <h1>{order.publicId}</h1>
        <span className="pill">{order.status}</span>
      </div>

      <div className="panel">
        <p>
          <strong>{order.customerName}</strong>
          <br />
          {order.customerEmail}
          <br />
          {order.customerPhone}
        </p>
        <p>
          {order.event.title} · {money(order.totalMinor)}
        </p>
        {order.eligibilityAnswer && (
          <div className="panel" style={{ background: "#fff8e8" }}>
            <strong>Ответ клиента</strong>
            <p>{order.eligibilityAnswer}</p>
          </div>
        )}
        <p className="muted">
          Запрошено: {order.items.map((item) => `${item.categoryName} × ${item.quantity}`).join(", ")}
        </p>
      </div>

      {order.status === "PENDING_APPROVAL" && staff.permissionSet.has("REQUEST_REVIEW") && (
        <>
          <h2>Решение организатора</h2>
          <ApprovalActions publicId={order.publicId} returnTo={returnTo} />
        </>
      )}

      {order.reviewNote && <div className="toast">Комментарий: {order.reviewNote}</div>}

      {order.status === "PAID" && order.tickets.length > 0 && staff.permissionSet.has("ORDER_MANAGE") && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h2 style={{ marginTop: 0 }}>Отправка билетов</h2>
          <p className="muted" style={{ marginBottom: 0 }}>
            Получатель: <strong>{order.customerEmail}</strong>. Письмо будет отправлено повторно со всеми билетами заказа и PDF-вложением.
          </p>
          <ResendTicketButton publicId={order.publicId} />
        </div>
      )}

      {order.tickets.length > 0 && <h2>Билеты</h2>}
      {order.tickets.map((ticket) => (
        <div className="panel row between" style={{ marginBottom: 12 }} key={ticket.id}>
          <div>
            <span className="pill">{ticket.status}</span>
            <h3>{ticket.category.name}</h3>
            <code>{ticket.publicCode}</code>
          </div>
          <div>
            {staff.permissionSet.has("ORDER_MANAGE") && <TicketActions id={ticket.id} status={ticket.status} />}
            <Link className="btn secondary" style={{ marginTop: 8 }} href={`/api/tickets/${ticket.id}/pdf`}>
              PDF
            </Link>
          </div>
        </div>
      ))}
    </AdminShell>
  );
}
