import Link from "next/link";
import { db } from "@/lib/db";
import { eventDate } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const requests = await db.order.findMany({
    where: { status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "REJECTED"] } },
    include: { event: true, items: true },
    orderBy: { createdAt: "desc" },
  });
  const pending = requests.filter((request) => request.status === "PENDING_APPROVAL");

  return (
    <AdminShell>
      <span className="eyebrow">Guest approval</span>
      <h1>Заявки на вход</h1>
      <p className="muted">Здесь появляются клиенты мероприятий с ручным одобрением.</p>
      <div className="stats">
        <div className="stat"><span className="muted">Ожидают решения</span><strong>{pending.length}</strong></div>
        <div className="stat"><span className="muted">Одобрены, ждут оплаты</span><strong>{requests.filter((request) => request.status === "AWAITING_PAYMENT").length}</strong></div>
        <div className="stat"><span className="muted">Отклонены</span><strong>{requests.filter((request) => request.status === "REJECTED").length}</strong></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Клиент</th><th>Событие</th><th>Билет</th><th>Ответ</th><th>Статус</th></tr></thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id}>
                <td><Link href={`/admin/orders/${request.publicId}`}><strong>{request.customerName}</strong></Link><br /><small>{request.customerPhone}</small></td>
                <td>{request.event.title}<br /><small>{eventDate(request.event.startsAt)}</small></td>
                <td>{request.items.map((item) => `${item.categoryName} × ${item.quantity}`).join(", ")}</td>
                <td>{request.eligibilityAnswer || "-"}</td>
                <td><span className="pill">{request.status}</span></td>
              </tr>
            ))}
            {requests.length === 0 && <tr><td colSpan={5} className="muted">Заявок пока нет</td></tr>}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
