import Link from "next/link";
import { db } from "@/lib/db";
import { money, eventDate } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const [events, orders, revenue, pendingRequests] = await Promise.all([
    db.event.findMany({ include: { venue: true, categories: true }, orderBy: { startsAt: "asc" } }),
    db.order.findMany({ take: 6, orderBy: { createdAt: "desc" }, include: { event: true, tickets: true } }),
    db.order.aggregate({ _sum: { totalMinor: true }, where: { status: "PAID" } }),
    db.order.count({ where: { status: "PENDING_APPROVAL" } }),
  ]);

  return (
    <AdminShell>
      <div className="row between">
        <div><span className="eyebrow">Organizer back-office</span><h1>Панель управления</h1></div>
        <Link href="/admin/events/new" className="btn">+ Новое событие</Link>
      </div>
      <div className="stats">
        <div className="stat"><span className="muted">Продажи</span><strong>{money(revenue._sum.totalMinor ?? 0)}</strong></div>
        <div className="stat"><span className="muted">Заказов</span><strong>{orders.length}</strong></div>
        <div className="stat"><span className="muted">Новые заявки</span><strong>{pendingRequests}</strong>{pendingRequests > 0 && <Link href="/admin/requests">Проверить →</Link>}</div>
      </div>

      <h2 className="section-title">Мероприятия</h2>
      <div className="table-wrap"><table><thead><tr><th>Событие</th><th>Дата</th><th>Режим продажи</th><th>Продано</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><Link href={`/admin/events/${event.id}`}><strong>{event.title}</strong></Link><br /><small>{event.venue.name}</small></td><td>{eventDate(event.startsAt)}</td><td><span className="pill">{event.salesMode === "INSTANT" ? "Автоматически" : "По одобрению"}</span></td><td>{event.categories.reduce((sum, category) => sum + category.sold, 0)} / {event.categories.reduce((sum, category) => sum + category.capacity, 0)}</td></tr>)}</tbody></table></div>

      <div className="row between"><h2 className="section-title">Последние заказы и заявки</h2><Link href="/admin/orders">Все →</Link></div>
      <div className="table-wrap"><table><thead><tr><th>Номер</th><th>Покупатель</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><Link href={`/admin/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td>{order.customerName}<br /><small>{order.customerEmail}</small></td><td>{money(order.totalMinor)}</td><td><span className="pill">{order.status}</span></td></tr>)}</tbody></table></div>
    </AdminShell>
  );
}
