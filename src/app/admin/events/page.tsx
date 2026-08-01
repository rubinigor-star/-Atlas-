import "./events-list.css";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type EventsPageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Черновик",
  REVIEW: "На модерации",
  PENDING_REVIEW: "На модерации",
  PUBLISHED: "Опубликовано",
  COMPLETED: "Завершено",
  CANCELLED: "Отменено",
  ARCHIVED: "Архив",
};

const filters = [
  { value: "all", label: "Все" },
  { value: "active", label: "Активные" },
  { value: "DRAFT", label: "Черновики" },
  { value: "PUBLISHED", label: "Опубликованные" },
  { value: "past", label: "Прошедшие" },
  { value: "CANCELLED", label: "Отменённые" },
];

function isInactiveStatus(status: string) {
  return status === "CANCELLED" || status === "ARCHIVED";
}

function matchesFilter(event: { status: string; startsAt: Date }, filter: string, now: Date) {
  if (filter === "all") return true;
  if (filter === "active") return event.startsAt >= now && !isInactiveStatus(event.status);
  if (filter === "past") return event.startsAt < now;
  return event.status === filter;
}

function pageHref(status: string, page: number) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/office/events?${query}` : "/office/events";
}

function statusClass(status: string) {
  return `events-status ${status.toLowerCase()}`;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const staff = await requirePermission("EVENT_VIEW");
  const query = await searchParams;
  const status = query.status || "all";
  const requestedPage = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const now = new Date();

  const eventIndex = await db.event.findMany({
    where: { organizationId: staff.organizationId! },
    select: { id: true, status: true, startsAt: true },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
  });

  const visibleEvents = eventIndex.filter((event) => canAccessEvent(staff, event.id));
  const filteredIndex = visibleEvents.filter((event) => matchesFilter(event, status, now));
  const totalPages = Math.max(1, Math.ceil(filteredIndex.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageIds = filteredIndex.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((event) => event.id);

  const events = pageIds.length
    ? await db.event.findMany({
        where: { id: { in: pageIds } },
        select: {
          id: true,
          title: true,
          slug: true,
          posterUrl: true,
          status: true,
          startsAt: true,
          venue: { select: { name: true, city: true } },
          categories: { select: { capacity: true, sold: true } },
        },
      })
    : [];

  const revenueRows = pageIds.length
    ? await db.order.groupBy({
        by: ["eventId"],
        where: { eventId: { in: pageIds }, status: "PAID" },
        _sum: { totalMinor: true },
      })
    : [];

  const eventById = new Map(events.map((event) => [event.id, event]));
  const revenueByEvent = new Map(revenueRows.map((row) => [row.eventId, row._sum.totalMinor || 0]));
  const orderedEvents = pageIds.map((id) => eventById.get(id)).filter((event): event is NonNullable<typeof event> => Boolean(event));

  return (
    <AdminShell>
      <div className="row between">
        <div>
          <span className="eyebrow">Organizer back-office</span>
          <h1>Мероприятия</h1>
          <p className="muted">Все мероприятия организации в одном визуальном рабочем списке.</p>
        </div>
        {staff.permissionSet.has("EVENT_MANAGE") && <Link prefetch={false} href="/office/events/new" className="btn">+ Создать мероприятие</Link>}
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 8, margin: "22px 0" }}>
        {filters.map((filter) => (
          <Link prefetch={false} key={filter.value} href={pageHref(filter.value, 1)} className={status === filter.value ? "btn dark" : "btn secondary"}>
            {filter.label}
          </Link>
        ))}
      </div>

      <div className="stats">
        <div className="stat"><span className="muted">Всего мероприятий</span><strong>{visibleEvents.length}</strong></div>
        <div className="stat"><span className="muted">Опубликовано</span><strong>{visibleEvents.filter((event) => event.status === "PUBLISHED").length}</strong></div>
        <div className="stat"><span className="muted">Предстоящие</span><strong>{visibleEvents.filter((event) => event.startsAt >= now && !isInactiveStatus(String(event.status))).length}</strong></div>
      </div>

      {orderedEvents.length === 0 ? (
        <div className="panel" style={{ marginTop: 24 }}>
          <h2>Мероприятий в этом разделе нет</h2>
          <p className="muted">Выберите другой фильтр или создайте новое мероприятие.</p>
        </div>
      ) : (
        <>
          <div className="events-visual-list">
            {orderedEvents.map((event) => {
              const sold = event.categories.reduce((sum, category) => sum + category.sold, 0);
              const capacity = event.categories.reduce((sum, category) => sum + category.capacity, 0);
              const fill = capacity ? Math.min(100, Math.round((sold / capacity) * 100)) : 0;
              const remaining = Math.max(0, capacity - sold);
              const eventRevenue = revenueByEvent.get(event.id) || 0;

              return (
                <article className="events-visual-card" key={event.id}>
                  <Link prefetch={false} href={`/office/events/${event.id}`} className="events-visual-poster" aria-label={`Открыть ${event.title}`}>
                    <img src={event.posterUrl || "/images/event-placeholder.jpg"} alt={`Афиша мероприятия ${event.title}`} />
                    <span>{fill}% заполнено</span>
                  </Link>

                  <div className="events-visual-main">
                    <div className="events-visual-topline">
                      <span>{eventDate(event.startsAt)}</span>
                      <span className={statusClass(event.status)}>{statusLabels[event.status] ?? event.status}</span>
                    </div>
                    <h2>{event.title}</h2>
                    <p className="events-visual-venue">{event.venue.name}, {event.venue.city}</p>
                    <div className="events-visual-progress" aria-label={`Заполнено ${fill}%`}><i style={{ width: `${fill}%` }} /></div>
                    <div className="events-visual-metrics">
                      <div><small>Продано</small><strong>{sold} / {capacity}</strong></div>
                      <div><small>Осталось</small><strong>{remaining}</strong></div>
                      <div><small>Выручка</small><strong>{money(eventRevenue)}</strong></div>
                    </div>
                  </div>

                  <div className="events-visual-actions">
                    <Link prefetch={false} className="btn" href={`/office/events/${event.id}`}>{staff.permissionSet.has("EVENT_MANAGE") ? "Управлять" : "Открыть"}</Link>
                    {event.status === "PUBLISHED" && <Link prefetch={false} className="btn secondary" href={`/events/${event.slug}`} target="_blank">Страница события</Link>}
                    <span className="events-visual-slug">/{event.slug}</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="row between" style={{ marginTop: 18 }}>
            <span className="muted">Страница {page} из {totalPages} · найдено {filteredIndex.length}</span>
            <div className="row" style={{ gap: 8 }}>
              {page > 1 && <Link prefetch={false} className="btn secondary" href={pageHref(status, page - 1)}>Назад</Link>}
              {page < totalPages && <Link prefetch={false} className="btn secondary" href={pageHref(status, page + 1)}>Дальше</Link>}
            </div>
          </div>
        </>
      )}
    </AdminShell>
  );
}
