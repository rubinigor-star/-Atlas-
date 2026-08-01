import "./workspace.css";
import Link from "next/link";
import { db } from "@/lib/db";
import { money, eventDate } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission, canAccessEvent } from "@/lib/auth";
import { recoveryDashboard } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";

const startOfDay = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);

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

function shortDay(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

export default async function Admin() {
  const staff = await requirePermission("EVENT_VIEW");
  const today = startOfDay();
  const monthStart = startOfMonth();
  const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 86400000));

  const [events, todayOrders, monthOrders, recentOrders, approvalCount, auditLogs, recovery, sevenDayOrders] = await Promise.all([
    db.event.findMany({
      where: { organizationId: staff.organizationId! },
      include: {
        venue: true,
        categories: true,
        orders: { where: { status: "PAID" }, select: { totalMinor: true, createdAt: true } },
      },
      orderBy: { startsAt: "asc" },
    }),
    db.order.findMany({
      where: { status: "PAID", createdAt: { gte: today }, event: { organizationId: staff.organizationId! } },
      select: { totalMinor: true },
    }),
    db.order.findMany({
      where: { status: "PAID", createdAt: { gte: monthStart }, event: { organizationId: staff.organizationId! } },
      select: { totalMinor: true },
    }),
    db.order.findMany({
      where: { event: { organizationId: staff.organizationId! } },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { event: true, tickets: true },
    }),
    db.order.count({ where: { status: "PENDING_APPROVAL", event: { organizationId: staff.organizationId! } } }),
    db.auditLog.findMany({ where: { organizationId: staff.organizationId! }, take: 6, orderBy: { createdAt: "desc" } }),
    recoveryDashboard(staff.organizationId!),
    db.order.findMany({
      where: { status: "PAID", createdAt: { gte: sevenDaysAgo }, event: { organizationId: staff.organizationId! } },
      select: { totalMinor: true, createdAt: true },
    }),
  ]);

  const visibleEvents = events.filter(event => canAccessEvent(staff, event.id));
  const upcomingEvents = visibleEvents.filter(event => event.startsAt >= today).slice(0, 8);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalMinor, 0);
  const monthRevenue = monthOrders.reduce((sum, order) => sum + order.totalMinor, 0);
  const averageCheck = monthOrders.length ? Math.round(monthRevenue / monthOrders.length) : 0;
  const abandonedCount = Number(recovery.totals.activeCount || 0);
  const potentialMinor = Number(recovery.totals.potentialMinor || 0);
  const attentionCount = approvalCount + abandonedCount;
  const firstName = staff.name?.split(" ")[0] || "организатор";

  const totals = upcomingEvents.reduce((acc, event) => {
    acc.sold += event.categories.reduce((sum, category) => sum + category.sold, 0);
    acc.capacity += event.categories.reduce((sum, category) => sum + category.capacity, 0);
    return acc;
  }, { sold: 0, capacity: 0 });
  const averageFill = totals.capacity ? Math.round((totals.sold / totals.capacity) * 100) : 0;

  const dailySales = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sevenDaysAgo);
    date.setDate(date.getDate() + index);
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const orders = sevenDayOrders.filter(order => order.createdAt >= date && order.createdAt < next);
    return { date, count: orders.length, revenue: orders.reduce((sum, order) => sum + order.totalMinor, 0) };
  });
  const maxDailyRevenue = Math.max(1, ...dailySales.map(day => day.revenue));
  const sevenDayRevenue = dailySales.reduce((sum, day) => sum + day.revenue, 0);
  const sevenDayTickets = dailySales.reduce((sum, day) => sum + day.count, 0);
  const chartPoints = dailySales.map((day, index) => {
    const x = 36 + index * 104;
    const y = 168 - Math.round((day.revenue / maxDailyRevenue) * 126);
    return { ...day, x, y };
  });
  const linePoints = chartPoints.map(point => `${point.x},${point.y}`).join(" ");
  const areaPoints = `36,168 ${linePoints} 660,168`;

  return <AdminShell>
    <section className="workspace-hero">
      <div>
        <h1>Доброе утро, {firstName}! <span aria-hidden="true">👋</span></h1>
        <p>Вот что происходит с вашими событиями сегодня.</p>
      </div>
      {staff.permissionSet.has("EVENT_MANAGE") && <Link href="/office/events/new" className="btn">+ Новое мероприятие</Link>}
    </section>

    <section className="workspace-kpis" aria-label="Ключевые показатели">
      <Link href="/office/orders" className="workspace-kpi workspace-kpi-sales">
        <span className="workspace-kpi-icon">↗</span><small>Продажи сегодня</small>
        <strong>{todayOrders.length} <em>бил.</em></strong><p>{money(todayRevenue)}</p><span className="workspace-kpi-arrow">→</span>
      </Link>
      <Link href="/office/abandoned" className="workspace-kpi workspace-kpi-lost">
        <span className="workspace-kpi-icon">◫</span><small>Потенциальная выручка</small>
        <strong>{money(potentialMinor)}</strong><p>{abandonedCount} потерянных оформлений</p><span className="workspace-kpi-arrow">→</span>
      </Link>
      <Link href="/office/orders" className="workspace-kpi workspace-kpi-revenue">
        <span className="workspace-kpi-icon">◎</span><small>Выручка за месяц</small>
        <strong>{money(monthRevenue)}</strong><p>{monthOrders.length} оплаченных заказов</p><span className="workspace-kpi-arrow">→</span>
      </Link>
      <Link href="/office/events" className="workspace-kpi workspace-kpi-fill">
        <span className="workspace-kpi-icon">◉</span><small>Средняя заполняемость</small>
        <strong>{averageFill}%</strong><p>{totals.sold} из {totals.capacity} мест</p><span className="workspace-kpi-ring" style={{ "--fill": `${averageFill * 3.6}deg` } as React.CSSProperties} />
      </Link>
      <Link href="/office/orders" className="workspace-kpi workspace-kpi-check">
        <span className="workspace-kpi-icon">₪</span><small>Средний чек</small>
        <strong>{money(averageCheck)}</strong><p>За текущий месяц</p><span className="workspace-kpi-arrow">→</span>
      </Link>
    </section>

    <section className="workspace-events-section">
      <div className="workspace-section-head">
        <div><h2>Ваши мероприятия</h2><p>Восемь ближайших событий и их текущие показатели.</p></div>
        <Link href="/office/events">Все мероприятия →</Link>
      </div>
      <div className="workspace-event-grid">
        {upcomingEvents.map(event => {
          const sold = event.categories.reduce((sum, category) => sum + category.sold, 0);
          const capacity = event.categories.reduce((sum, category) => sum + category.capacity, 0);
          const fill = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
          const eventRevenue = event.orders.reduce((sum, order) => sum + order.totalMinor, 0);
          const days = daysUntil(event.startsAt);
          return <Link href={`/office/events/${event.id}`} className="workspace-event-card" key={event.id}>
            <div className="workspace-event-image">
              <img src={event.posterUrl} alt={`Афиша ${event.title}`} />
              <span>{days <= 0 ? "Сегодня" : `Через ${days} дн.`}</span>
            </div>
            <div className="workspace-event-body">
              <small>{eventDate(event.startsAt)} · {event.venue.name}</small><h3>{event.title}</h3>
              <div className="workspace-event-metrics"><span><b>{sold} / {capacity}</b><small>продано</small></span><span><b>{money(eventRevenue)}</b><small>выручка</small></span><span><b>{Math.max(0, capacity - sold)}</b><small>осталось</small></span></div>
              <div className="workspace-progress"><i style={{ width: `${fill}%` }} /></div>
            </div>
          </Link>;
        })}
        {!upcomingEvents.length && <div className="office-empty"><h3>Нет ближайших мероприятий</h3><p>Создайте мероприятие, и оно появится здесь.</p></div>}
      </div>
    </section>

    <details className="workspace-activity-panel">
      <summary><span><strong>Последняя активность</strong><small>Краткий журнал последних действий</small></span><b>Показать всё</b></summary>
      <div className="workspace-activity-grid">
        {recentOrders.slice(0,5).map(order => <Link href={`/office/orders/${order.publicId}`} key={order.id}><i>{order.status === "PAID" ? "₪" : "•"}</i><div><strong>{order.status === "PAID" ? "Новая продажа" : "Обновление заказа"}</strong><small>{order.event.title} · {order.tickets.length} бил.</small></div><time>{relativeTime(order.createdAt)}</time></Link>)}
        {auditLogs.slice(0,3).map(log => <div key={log.id}><i>↻</i><div><strong>{log.summary}</strong><small>{log.entityType}</small></div><time>{relativeTime(log.createdAt)}</time></div>)}
        {!recentOrders.length && !auditLogs.length && <p className="muted">Активность появится после первых действий.</p>}
      </div>
    </details>

    <section className="workspace-bottom-grid">
      <article className="workspace-chart-panel">
        <div className="workspace-panel-head"><div><h2>Динамика продаж</h2><p>Последние 7 дней</p></div><span>{money(sevenDayRevenue)}</span></div>
        <div className="workspace-line-chart">
          <svg viewBox="0 0 700 205" role="img" aria-label="Линейный график выручки за семь дней">
            <defs><linearGradient id="salesArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2463eb" stopOpacity=".22"/><stop offset="100%" stopColor="#2463eb" stopOpacity="0"/></linearGradient></defs>
            {[42,84,126,168].map(y => <line key={y} x1="36" y1={y} x2="660" y2={y} className="chart-grid-line" />)}
            <polygon points={areaPoints} fill="url(#salesArea)" />
            <polyline points={linePoints} className="chart-sales-line" />
            {chartPoints.map(point => <g key={point.date.toISOString()}><circle cx={point.x} cy={point.y} r="5" className="chart-sales-point"/><text x={point.x} y="194" textAnchor="middle" className="chart-label">{shortDay(point.date)}</text></g>)}
          </svg>
        </div>
        <footer><span><b>{money(sevenDayRevenue)}</b><small>Выручка за 7 дней</small></span><span><b>{sevenDayTickets}</b><small>Всего заказов</small></span></footer>
      </article>

      <article className="workspace-attention-panel">
        <div className="workspace-panel-head"><div><h2>Требует внимания</h2><p>Только задачи, где нужно действие</p></div>{attentionCount > 0 && <span className="workspace-count">{attentionCount}</span>}</div>
        <Link href="/office/abandoned" className="workspace-action"><i>🛒</i><div><strong>{abandonedCount} потерянных оформлений</strong><small>Потенциально {money(potentialMinor)}</small></div><b>›</b></Link>
        <Link href="/office/requests" className="workspace-action"><i>✓</i><div><strong>{approvalCount} заявок на рассмотрении</strong><small>Ожидают решения организатора</small></div><b>›</b></Link>
        {upcomingEvents[0] && <Link href={`/office/events/${upcomingEvents[0].id}`} className="workspace-action"><i>◷</i><div><strong>{upcomingEvents[0].title}</strong><small>Ближайшее событие · {eventDate(upcomingEvents[0].startsAt)}</small></div><b>›</b></Link>}
        <Link href="/office/events" className="workspace-attention-more">Перейти ко всем задачам</Link>
      </article>
    </section>
  </AdminShell>;
}
