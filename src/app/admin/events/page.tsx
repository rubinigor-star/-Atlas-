import "./events-list.css";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { EventListActions } from "./event-list-actions";
import { EventStatusFilter } from "./event-status-filter";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";
import { getServerI18n } from "@/lib/server-locale";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const soldOutPattern = /<!--ATLAS_SOLD_OUT:true-->/;
const lastTicketsPattern = /<!--ATLAS_LAST_TICKETS:true-->/;
const doorsPattern = /<!--ATLAS_DOORS_OPEN:([^>]+)-->/;

type EventsPageProps = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Приостановлено",
  REVIEW: "На модерации",
  PENDING_REVIEW: "На модерации",
  PUBLISHED: "Опубликовано",
  COMPLETED: "Завершено",
  CANCELLED: "Выключено",
  ARCHIVED: "Архив",
};

const filterValues = ["all", "active", "DRAFT", "PUBLISHED", "past", "CANCELLED"] as const;
type FilterValue = (typeof filterValues)[number];

const filterCopy: Record<"ru" | "he" | "en", {
  label: string;
  clear: string;
  options: Record<FilterValue, string>;
}> = {
  ru: {
    label: "Статус мероприятия",
    clear: "Сбросить",
    options: {
      all: "Все",
      active: "Активные",
      DRAFT: "Приостановленные",
      PUBLISHED: "Опубликованные",
      past: "Прошедшие",
      CANCELLED: "Выключенные",
    },
  },
  en: {
    label: "Event status",
    clear: "Clear",
    options: {
      all: "All",
      active: "Active",
      DRAFT: "Paused",
      PUBLISHED: "Published",
      past: "Past",
      CANCELLED: "Disabled",
    },
  },
  he: {
    label: "סטטוס אירוע",
    clear: "נקה",
    options: {
      all: "הכל",
      active: "פעילים",
      DRAFT: "מושהים",
      PUBLISHED: "פורסמו",
      past: "אירועים שעברו",
      CANCELLED: "מושבתים",
    },
  },
};

function isInactiveStatus(status: string) {
  return status === "CANCELLED" || status === "ARCHIVED" || status === "DRAFT";
}

function matchesFilter(event: { status: string; startsAt: Date }, filter: string, now: Date) {
  if (filter === "all") return true;
  if (filter === "active") return event.startsAt >= now && event.status === "PUBLISHED";
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

function cardStateClass(status: string, soldOut: boolean) {
  if (soldOut) return " is-sold-out";
  if (status === "PUBLISHED") return " is-published";
  if (status === "DRAFT") return " is-paused";
  return " is-disabled";
}

function doorsOpenAt(description: string, startsAt: Date) {
  const match = description.match(doorsPattern)?.[1];
  if (!match) return startsAt;
  const parsed = new Date(match);
  return Number.isNaN(parsed.getTime()) ? startsAt : parsed;
}

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const staff = await requirePermission("EVENT_VIEW");
  const { locale } = await getServerI18n();
  const query = await searchParams;
  const status = query.status || "all";
  const requestedPage = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const now = new Date();
  const filterText = filterCopy[locale];
  const filterOptions = filterValues.map((value) => ({
    value,
    label: filterText.options[value],
    href: pageHref(value, 1),
  }));

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
          description: true,
          posterUrl: true,
          status: true,
          startsAt: true,
          salesStart: true,
          salesEnd: true,
          venue: { select: { name: true, city: true, address: true } },
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
  const canManage = staff.permissionSet.has("EVENT_MANAGE");

  return (
    <AdminShell>
      <div className="row between">
        <div>
          <span className="eyebrow">Organizer back-office</span>
          <h1>Мероприятия</h1>
          <p className="muted">Все мероприятия организации в одном визуальном рабочем списке.</p>
        </div>
        {canManage && <Link prefetch={false} href="/office/events/new" className="btn">+ Создать мероприятие</Link>}
      </div>

      <div className="event-status-filter-row">
        <EventStatusFilter
          locale={locale}
          label={filterText.label}
          clearLabel={filterText.clear}
          current={status}
          options={filterOptions}
        />
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
              const soldOut = soldOutPattern.test(event.description);
              const lastTickets = lastTicketsPattern.test(event.description);
              const doors = doorsOpenAt(event.description, event.startsAt);

              return (
                <article className={`events-visual-card${cardStateClass(event.status, soldOut)}`} key={event.id}>
                  <Link prefetch={false} href={`/office/events/${event.id}`} className="events-visual-poster" aria-label={`Открыть ${event.title}`}>
                    <img src={event.posterUrl || "/images/event-placeholder.jpg"} alt={`Афиша мероприятия ${event.title}`} />
                    {soldOut && <strong className="events-sold-out-ribbon">SOLD OUT</strong>}
                    {lastTickets && !soldOut && <strong className="events-last-tickets-ribbon">ПОСЛЕДНИЕ БИЛЕТЫ</strong>}
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
                      <div><small>Продано</small><strong>{sold}</strong></div>
                      <div><small>Осталось</small><strong>{remaining}</strong></div>
                      <div><small>Вместимость</small><strong>{capacity}</strong></div>
                      <div><small>Выручка</small><strong>{money(eventRevenue)}</strong></div>
                    </div>
                  </div>

                  <EventListActions
                    canManage={canManage}
                    event={{
                      id: event.id,
                      title: event.title,
                      slug: event.slug,
                      status: event.status,
                      soldOut,
                      lastTickets,
                      startsAt: event.startsAt.toISOString(),
                      doorsOpenAt: doors.toISOString(),
                      salesStart: event.salesStart.toISOString(),
                      salesEnd: event.salesEnd.toISOString(),
                      venueName: event.venue.name,
                      city: event.venue.city,
                      address: event.venue.address,
                    }}
                  />
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
