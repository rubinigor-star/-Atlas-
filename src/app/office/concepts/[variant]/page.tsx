import "../concepts.css";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { money, eventDate } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission, canAccessEvent } from "@/lib/auth";
import { recoveryDashboard } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";

type Variant = "a" | "b" | "c" | "d";

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

const variantNames: Record<Variant, string> = {
  a: "A · Balanced",
  b: "B · Event First",
  c: "C · Mission Control",
  d: "D · Minimal",
};

export default async function ConceptPage({ params }: { params: Promise<{ variant: string }> }) {
  const { variant: rawVariant } = await params;
  if (!["a", "b", "c", "d"].includes(rawVariant)) notFound();
  const variant = rawVariant as Variant;
  const staff = await requirePermission("EVENT_VIEW");
  const today = startOfToday();

  const [events, todayOrders, recentOrders, approvalCount, recovery] = await Promise.all([
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
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { event: true, tickets: true },
    }),
    db.order.count({ where: { status: "PENDING_APPROVAL", event: { organizationId: staff.organizationId! } } }),
    recoveryDashboard(staff.organizationId!),
  ]);

  const visibleEvents = events.filter(event => canAccessEvent(staff, event.id));
  const upcomingEvents = visibleEvents.filter(event => event.startsAt >= today).slice(0, 6);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + order.totalMinor, 0);
  const abandonedCount = Number(recovery.totals.activeCount || 0);
  const potentialMinor = Number(recovery.totals.potentialMinor || 0);
  const attentionCount = approvalCount + abandonedCount;
  const firstName = staff.name?.split(" ")[0] || "организатор";

  const eventCards = upcomingEvents.map(event => {
    const sold = event.categories.reduce((sum, category) => sum + category.sold, 0);
    const capacity = event.categories.reduce((sum, category) => sum + category.capacity, 0);
    const fill = capacity ? Math.min(100, Math.round(sold / capacity * 100)) : 0;
    const revenue = event.orders.reduce((sum, order) => sum + order.totalMinor, 0);
    const todaySold = event.orders.filter(order => order.createdAt >= today).length;
    return { event, sold, capacity, fill, revenue, todaySold, days: daysUntil(event.startsAt) };
  });

  return <AdminShell>
    <div className={`concept concept-${variant}`}>
      <nav className="concept-switcher" aria-label="Варианты дизайна">
        {(["a", "b", "c", "d"] as Variant[]).map(item => <Link key={item} href={`/office/concepts/${item}`} className={variant === item ? "active" : ""}>{variantNames[item]}</Link>)}
      </nav>

      <header className="concept-head">
        <div><span>Концепт {variant.toUpperCase()}</span><h1>{variant === "b" ? "Мои мероприятия" : variant === "c" ? "Центр управления" : variant === "d" ? `Добрый день, ${firstName}` : `Главная, ${firstName}`}</h1><p>{variant === "b" ? "Все события и быстрые действия на одном экране." : variant === "c" ? "Сначала проблемы и ближайшие операционные задачи." : variant === "d" ? "Только важное. Без визуального шума." : "Сбалансированный обзор бизнеса и мероприятий."}</p></div>
        {staff.permissionSet.has("EVENT_MANAGE") && <Link href="/office/events/new" className="btn">+ Новое мероприятие</Link>}
      </header>

      {variant !== "b" && <section className="concept-kpis">
        <article><small>Продажи сегодня</small><strong>{todayOrders.length}</strong><span>{money(todayRevenue)}</span></article>
        <article><small>Активные события</small><strong>{upcomingEvents.length}</strong><span>{upcomingEvents[0] ? eventDate(upcomingEvents[0].startsAt) : "Нет ближайших"}</span></article>
        <article><small>Требует внимания</small><strong>{attentionCount}</strong><span>{abandonedCount} abandoned · {approvalCount} заявок</span></article>
        <article><small>Потенциальная выручка</small><strong>{money(potentialMinor)}</strong><span>Из потерянных оформлений</span></article>
      </section>}

      {variant === "b" && <section className="event-first-summary"><span><b>{todayOrders.length}</b> продаж сегодня</span><span><b>{upcomingEvents.length}</b> активных событий</span><span><b>{attentionCount}</b> требуют внимания</span></section>}

      <div className="concept-body">
        {variant === "c" && <aside className="mission-rail">
          <h2>Требует действия</h2>
          <Link href="/office/abandoned"><b>{abandonedCount}</b><span>Потерянные оформления<small>{money(potentialMinor)} потенциально</small></span></Link>
          <Link href="/office/requests"><b>{approvalCount}</b><span>Заявки на рассмотрении<small>Ожидают решения</small></span></Link>
          {eventCards[0] && <Link href={`/office/events/${eventCards[0].event.id}`}><b>{eventCards[0].days <= 0 ? "!" : eventCards[0].days}</b><span>{eventCards[0].event.title}<small>{eventDate(eventCards[0].event.startsAt)}</small></span></Link>}
          <h3>Последние действия</h3>
          {recentOrders.slice(0,5).map(order => <Link className="mission-activity" href={`/office/orders/${order.publicId}`} key={order.id}><span>{order.status === "PAID" ? "Продажа" : "Заказ"}<small>{order.event.title}</small></span><time>{relativeTime(order.createdAt)}</time></Link>)}
        </aside>}

        <main className="concept-main">
          <div className="concept-section-title"><div><span>{variant === "c" ? "События" : "Ваши мероприятия"}</span><h2>{variant === "b" ? "В центре Atlas" : variant === "d" ? "Ближайшие" : "Активные мероприятия"}</h2></div><Link href="/office/events">Все →</Link></div>
          <div className="concept-events">
            {eventCards.map(({event,sold,capacity,fill,revenue,todaySold,days}) => <Link className="concept-event" href={`/office/events/${event.id}`} key={event.id}>
              <div className="concept-poster"><img src={event.posterUrl} alt=""/><span>{days <= 0 ? "Сегодня" : `Через ${days} дн.`}</span></div>
              <div className="concept-event-copy"><small>{eventDate(event.startsAt)} · {event.venue.name}</small><h3>{event.title}</h3><div className="concept-progress"><i style={{width:`${fill}%`}}/></div><div className="concept-event-line"><strong>{sold} / {capacity}</strong><span>{fill}% заполнено</span></div><footer><span>{money(revenue)}</span><span>+{todaySold} сегодня</span></footer></div>
            </Link>)}
            {!eventCards.length && <div className="office-empty"><h3>Нет ближайших мероприятий</h3><p>Создайте первое событие.</p></div>}
          </div>
        </main>

        {variant !== "c" && <aside className="concept-side">
          <section><header><h2>Требует внимания</h2><b>{attentionCount}</b></header><Link href="/office/abandoned"><span>Потерянные оформления</span><strong>{abandonedCount}</strong></Link><Link href="/office/requests"><span>Заявки</span><strong>{approvalCount}</strong></Link></section>
          <section><header><h2>Последняя активность</h2></header>{recentOrders.slice(0,5).map(order => <Link href={`/office/orders/${order.publicId}`} key={order.id}><span>{order.status === "PAID" ? "Новая продажа" : "Обновление заказа"}<small>{order.event.title}</small></span><time>{relativeTime(order.createdAt)}</time></Link>)}</section>
        </aside>}
      </div>
    </div>
  </AdminShell>;
}
