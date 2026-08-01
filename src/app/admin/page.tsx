import Link from "next/link";
import { db } from "@/lib/db";
import { money, eventDate } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission, canAccessEvent } from "@/lib/auth";
import { recoveryDashboard } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

function relativeTime(date: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.floor(hours / 24)} дн назад`;
}

function daysUntil(date: Date) {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

export default async function Admin() {
  const staff = await requirePermission("EVENT_VIEW");
  const today = startOfToday();

  const [events, todayOrders, recentOrders, approvalCount, auditLogs, recovery] = await Promise.all([
    db.event.findMany({
      where: { organizationId: staff.organizationId! },
      include: { venue: true, categories: true, orders: { where: { status: "PAID" }, select: { totalMinor: true, createdAt: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.order.findMany({
      where: { status: "PAID", createdAt: { gte: today }, event: { organizationId: staff.organizationId! } },
      select: { totalMinor: true },
    }),
    db.order.findMany({
      where: { event: { organizationId: staff.organizationId! } },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: { event: true, tickets: true },
    }),
    db.order.count({
      where: { status: "PENDING_APPROVAL", event: { organizationId: staff.organizationId! } },
    }),
    db.auditLog.findMany({
      where: { organizationId: staff.organizationId! },
      take: 6,
      orderBy: { createdAt: "desc" },
    }),
    recoveryDashboard(staff.organizationId!),
  ]);

  const visibleEvents = events.filter(event => canAccessEvent(staff, event.id));
  const upcomingEvents = visibleEvents.filter(event => event.startsAt >= today).slice(0, 4);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalMinor, 0);
  const abandonedCount = Number(recovery.totals.activeCount || 0);
  const attentionCount = approvalCount + abandonedCount;
  const firstName = staff.name?.split(" ")[0] || "организатор";

  return <AdminShell>
    <section className="workspace-hero">
      <div>
        <span className="eyebrow">Главная</span>
        <h1>Добро пожаловать, {firstName}</h1>
        <p>Самое важное по вашим мероприятиям на сегодня.</p>
      </div>
      {staff.permissionSet.has("EVENT_MANAGE") && <Link href="/office/events/new" className="btn">+ Новое мероприятие</Link>}
    </section>

    <section className="workspace-kpis">
      <article><span className="workspace-kpi-icon">↗</span><div><small>Продажи сегодня</small><strong>{todayOrders.length}</strong><p>{money(todayRevenue)}</p></div></article>
      <article><span className="workspace-kpi-icon">◫</span><div><small>Ближайшие мероприятия</small><strong>{upcomingEvents.length}</strong><p>{upcomingEvents[0] ? `Следующее: ${eventDate(upcomingEvents[0].startsAt)}` : "Нет запланированных"}</p></div></article>
      <article><span className="workspace-kpi-icon">!</span><div><small>Требует внимания</small><strong>{attentionCount}</strong><p>{abandonedCount} потерянных, {approvalCount} заявок</p></div></article>
      <article><span className="workspace-kpi-icon">◎</span><div><small>Потенциальная выручка</small><strong>{money(Number(recovery.totals.potentialMinor || 0))}</strong><p>Из потерянных оформлений</p></div></article>
    </section>

    <div className="workspace-layout">
      <main>
        <div className="workspace-section-head">
          <div><span className="eyebrow">Ваши мероприятия</span><h2>В центре внимания</h2></div>
          <Link href="/office/events">Все мероприятия →</Link>
        </div>

        <div className="workspace-event-grid">
          {upcomingEvents.map(event => {
            const sold = event.categories.reduce((sum, category) => sum + category.sold, 0);
            const capacity = event.categories.reduce((sum, category) => sum + category.capacity, 0);
            const fill = capacity ? Math.min(100, Math.round(sold / capacity * 100)) : 0;
            const eventRevenue = event.orders.reduce((sum, order) => sum + order.totalMinor, 0);
            const todaySold = event.orders.filter(order => order.createdAt >= today).length;
            const days = daysUntil(event.startsAt);
            return <Link href={`/office/events/${event.id}`} className="workspace-event-card" key={event.id}>
              <div className="workspace-event-image">
                <img src={event.posterUrl} alt="" />
                <span>{days <= 0 ? "Сегодня" : `Через ${days} дн.`}</span>
              </div>
              <div className="workspace-event-body">
                <small>{eventDate(event.startsAt)} · {event.venue.name}</small>
                <h3>{event.title}</h3>
                <div className="workspace-progress"><i style={{width:`${fill}%`}} /></div>
                <div className="workspace-event-numbers"><strong>{sold} / {capacity}</strong><span>{capacity - sold} осталось</span></div>
                <footer><span>Выручка: <b>{money(eventRevenue)}</b></span><span>Сегодня: <b>+{todaySold}</b></span></footer>
              </div>
            </Link>;
          })}
          {!upcomingEvents.length && <div className="office-empty"><h3>Нет ближайших мероприятий</h3><p>Создайте мероприятие, и оно появится здесь.</p></div>}
        </div>
      </main>

      <aside className="workspace-side">
        <section className="workspace-panel">
          <div className="workspace-panel-head"><h2>Требует внимания</h2>{attentionCount > 0 && <span>{attentionCount}</span>}</div>
          <Link href="/office/abandoned" className="workspace-action"><i>🛒</i><div><strong>{abandonedCount} потерянных оформлений</strong><small>Проверить и запустить сценарий</small></div><b>›</b></Link>
          <Link href="/office/requests" className="workspace-action"><i>✓</i><div><strong>{approvalCount} заявок на рассмотрении</strong><small>Принять решение по гостям</small></div><b>›</b></Link>
          {upcomingEvents[0] && <Link href={`/office/events/${upcomingEvents[0].id}`} className="workspace-action"><i>◷</i><div><strong>{upcomingEvents[0].title}</strong><small>Ближайшее мероприятие · {eventDate(upcomingEvents[0].startsAt)}</small></div><b>›</b></Link>}
        </section>

        <section className="workspace-panel">
          <div className="workspace-panel-head"><h2>Последняя активность</h2></div>
          <div className="workspace-activity">
            {recentOrders.slice(0,4).map(order => <Link href={`/office/orders/${order.publicId}`} key={order.id}><i>{order.status === "PAID" ? "₪" : "•"}</i><div><strong>{order.status === "PAID" ? "Новая продажа" : "Обновление заказа"}</strong><small>{order.event.title} · {order.tickets.length} бил.</small></div><time>{relativeTime(order.createdAt)}</time></Link>)}
            {auditLogs.slice(0,2).map(log => <div key={log.id}><i>↻</i><div><strong>{log.summary}</strong><small>{log.entityType}</small></div><time>{relativeTime(log.createdAt)}</time></div>)}
            {!recentOrders.length && !auditLogs.length && <p className="muted">Активность появится после первых действий.</p>}
          </div>
        </section>
      </aside>
    </div>
  </AdminShell>;
}
