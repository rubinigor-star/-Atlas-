import "./events-list.css";
import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { EventListActions } from "./event-list-actions";
import { EventStatusFilter } from "./event-status-filter";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";
import { resolveStaffLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const soldOutPattern = /<!--ATLAS_SOLD_OUT:true-->/;
const lastTicketsPattern = /<!--ATLAS_LAST_TICKETS:true-->/;
const doorsPattern = /<!--ATLAS_DOORS_OPEN:([^>]+)-->/;

type EventsPageProps = { searchParams: Promise<{ status?: string; page?: string }> };
const filterValues = ["all", "active", "DRAFT", "PUBLISHED", "past", "CANCELLED"] as const;
type FilterValue = (typeof filterValues)[number];

const copy = {
  ru: {
    eyebrow:"Кабинет организатора", title:"Мероприятия", description:"Все мероприятия организации в одном визуальном рабочем списке.", create:"+ Создать мероприятие",
    total:"Всего мероприятий", published:"Опубликовано", drafts:"Черновики", emptyTitle:"Мероприятий в этом разделе нет", emptyText:"Выберите другой фильтр или создайте новое мероприятие.",
    lastTickets:"ПОСЛЕДНИЕ БИЛЕТЫ", filled:"заполнено", sold:"Продано", remaining:"Осталось", capacity:"Вместимость", revenue:"Выручка", open:"Открыть", poster:"Афиша мероприятия", found:"найдено", page:"Страница", of:"из", back:"Назад", next:"Дальше",
    filter:{label:"Статус мероприятия",clear:"Сбросить",options:{all:"Все",active:"Активные",DRAFT:"Черновики",PUBLISHED:"Опубликованные",past:"Прошедшие",CANCELLED:"Выключенные"}},
    statuses:{DRAFT:"Черновик",REVIEW:"На модерации",PENDING_REVIEW:"На модерации",PUBLISHED:"Опубликовано",COMPLETED:"Завершено",CANCELLED:"Выключено",ARCHIVED:"Архив"}
  },
  he: {
    eyebrow:"אזור המפיקים", title:"אירועים", description:"כל אירועי הארגון במקום אחד, בתצוגת עבודה ברורה.", create:"+ יצירת אירוע",
    total:"סה״כ אירועים", published:"פורסמו", drafts:"טיוטות", emptyTitle:"אין אירועים בתצוגה הזו", emptyText:"בחרו סינון אחר או צרו אירוע חדש.",
    lastTickets:"כרטיסים אחרונים", filled:"תפוסה", sold:"נמכרו", remaining:"נותרו", capacity:"תפוסה מרבית", revenue:"הכנסות", open:"פתיחת", poster:"פוסטר האירוע", found:"נמצאו", page:"עמוד", of:"מתוך", back:"הקודם", next:"הבא",
    filter:{label:"סטטוס אירוע",clear:"נקה",options:{all:"הכל",active:"פעילים",DRAFT:"טיוטות",PUBLISHED:"פורסמו",past:"אירועים שעברו",CANCELLED:"מושבתים"}},
    statuses:{DRAFT:"טיוטה",REVIEW:"בבדיקה",PENDING_REVIEW:"בבדיקה",PUBLISHED:"פורסם",COMPLETED:"הסתיים",CANCELLED:"מושבת",ARCHIVED:"ארכיון"}
  },
  en: {
    eyebrow:"Organizer back office", title:"Events", description:"All organization events in one visual workspace.", create:"+ Create event",
    total:"Total events", published:"Published", drafts:"Drafts", emptyTitle:"No events in this view", emptyText:"Choose another filter or create a new event.",
    lastTickets:"LAST TICKETS", filled:"filled", sold:"Sold", remaining:"Remaining", capacity:"Capacity", revenue:"Revenue", open:"Open", poster:"Event poster", found:"found", page:"Page", of:"of", back:"Back", next:"Next",
    filter:{label:"Event status",clear:"Clear",options:{all:"All",active:"Active",DRAFT:"Drafts",PUBLISHED:"Published",past:"Past",CANCELLED:"Disabled"}},
    statuses:{DRAFT:"Draft",REVIEW:"In review",PENDING_REVIEW:"In review",PUBLISHED:"Published",COMPLETED:"Completed",CANCELLED:"Disabled",ARCHIVED:"Archive"}
  }
} as const;

function matchesFilter(event: { status: string; startsAt: Date }, filter: string, now: Date) {
  if (filter === "all") return true;
  if (filter === "active") return event.startsAt >= now && event.status === "PUBLISHED";
  if (filter === "past") return event.startsAt < now;
  return event.status === filter;
}
function pageHref(status: string, page: number) { const params=new URLSearchParams(); if(status!=="all")params.set("status",status); if(page>1)params.set("page",String(page)); const query=params.toString(); return query?`/office/events?${query}`:"/office/events"; }
function statusClass(status: string) { return `events-status ${status.toLowerCase()}`; }
function cardStateClass(status: string, soldOut: boolean) { if(soldOut)return " is-sold-out"; if(status==="PUBLISHED")return " is-published"; if(status==="DRAFT")return " is-paused"; return " is-disabled"; }
function doorsOpenAt(description: string, startsAt: Date) { const match=description.match(doorsPattern)?.[1]; if(!match)return startsAt; const parsed=new Date(match); return Number.isNaN(parsed.getTime())?startsAt:parsed; }

export default async function EventsPage({ searchParams }: EventsPageProps) {
  const staff = await requirePermission("EVENT_VIEW");
  const locale = resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text = copy[locale];
  const query = await searchParams;
  const status = query.status || "all";
  const requestedPage = Math.max(1, Number.parseInt(query.page || "1", 10) || 1);
  const now = new Date();
  const filterOptions = filterValues.map((value) => ({ value, label:text.filter.options[value], href:pageHref(value,1) }));

  const eventIndex = await db.event.findMany({ where:{organizationId:staff.organizationId!}, select:{id:true,status:true,startsAt:true}, orderBy:[{startsAt:"desc"},{createdAt:"desc"}] });
  const visibleEvents = eventIndex.filter((event)=>canAccessEvent(staff,event.id));
  const filteredIndex = visibleEvents.filter((event)=>matchesFilter(event,status,now));
  const totalPages = Math.max(1,Math.ceil(filteredIndex.length/PAGE_SIZE));
  const page = Math.min(requestedPage,totalPages);
  const pageIds = filteredIndex.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE).map((event)=>event.id);
  const events = pageIds.length ? await db.event.findMany({where:{id:{in:pageIds}},select:{id:true,title:true,slug:true,description:true,posterUrl:true,status:true,startsAt:true,salesStart:true,salesEnd:true,venue:{select:{name:true,city:true,address:true}},categories:{select:{capacity:true,sold:true}}}}) : [];
  const revenueRows = pageIds.length ? await db.order.groupBy({by:["eventId"],where:{eventId:{in:pageIds},status:"PAID"},_sum:{totalMinor:true}}) : [];
  const eventById=new Map(events.map((event)=>[event.id,event]));
  const revenueByEvent=new Map(revenueRows.map((row)=>[row.eventId,row._sum.totalMinor||0]));
  const orderedEvents=pageIds.map((id)=>eventById.get(id)).filter((event):event is NonNullable<typeof event>=>Boolean(event));
  const canManage=staff.permissionSet.has("EVENT_MANAGE");

  return <AdminShell>
    <div className="row between"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p className="muted">{text.description}</p></div>{canManage&&<Link prefetch={false} href="/office/events/new" className="btn">{text.create}</Link>}</div>
    <div className="event-status-filter-row"><EventStatusFilter locale={locale} label={text.filter.label} clearLabel={text.filter.clear} current={status} options={filterOptions}/></div>
    <div className="stats"><div className="stat"><span className="muted">{text.total}</span><strong>{visibleEvents.length}</strong></div><div className="stat"><span className="muted">{text.published}</span><strong>{visibleEvents.filter((event)=>event.status==="PUBLISHED").length}</strong></div><div className="stat"><span className="muted">{text.drafts}</span><strong>{visibleEvents.filter((event)=>event.status==="DRAFT").length}</strong></div></div>
    {orderedEvents.length===0?<div className="panel" style={{marginTop:24}}><h2>{text.emptyTitle}</h2><p className="muted">{text.emptyText}</p></div>:<>
      <div className="events-visual-list">{orderedEvents.map((event)=>{const sold=event.categories.reduce((sum,category)=>sum+category.sold,0);const capacity=event.categories.reduce((sum,category)=>sum+category.capacity,0);const fill=capacity?Math.min(100,Math.round(sold/capacity*100)):0;const remaining=Math.max(0,capacity-sold);const eventRevenue=revenueByEvent.get(event.id)||0;const soldOut=soldOutPattern.test(event.description);const lastTickets=lastTicketsPattern.test(event.description);const doors=doorsOpenAt(event.description,event.startsAt);return <article className={`events-visual-card${cardStateClass(event.status,soldOut)}`} key={event.id}>
        <Link prefetch={false} href={`/office/events/${event.id}`} className="events-visual-poster" aria-label={`${text.open} ${event.title}`}><img src={event.posterUrl||"/images/event-placeholder.jpg"} alt={`${text.poster} ${event.title}`}/>{soldOut&&<strong className="events-sold-out-ribbon">SOLD OUT</strong>}{lastTickets&&!soldOut&&<strong className="events-last-tickets-ribbon">{text.lastTickets}</strong>}<span>{fill}% {text.filled}</span></Link>
        <div className="events-visual-main"><div className="events-visual-topline"><span>{eventDate(event.startsAt)}</span><span className={statusClass(event.status)}>{text.statuses[event.status as keyof typeof text.statuses]??event.status}</span></div><h2>{event.title}</h2><p className="events-visual-venue">{event.venue.name}, {event.venue.city}</p><div className="events-visual-progress" aria-label={`${fill}% ${text.filled}`}><i style={{width:`${fill}%`}}/></div><div className="events-visual-metrics"><div><small>{text.sold}</small><strong>{sold}</strong></div><div><small>{text.remaining}</small><strong>{remaining}</strong></div><div><small>{text.capacity}</small><strong>{capacity}</strong></div><div><small>{text.revenue}</small><strong><bdi>{money(eventRevenue)}</bdi></strong></div></div></div>
        <EventListActions locale={locale} canManage={canManage} event={{id:event.id,title:event.title,slug:event.slug,status:event.status,soldOut,lastTickets,startsAt:event.startsAt.toISOString(),doorsOpenAt:doors.toISOString(),salesStart:event.salesStart.toISOString(),salesEnd:event.salesEnd.toISOString(),venueName:event.venue.name,city:event.venue.city,address:event.venue.address}}/>
      </article>})}</div>
      <div className="row between" style={{marginTop:18}}><span className="muted">{text.page} {page} {text.of} {totalPages} · {text.found} {filteredIndex.length}</span><div className="row" style={{gap:8}}>{page>1&&<Link prefetch={false} className="btn secondary" href={pageHref(status,page-1)}>{text.back}</Link>}{page<totalPages&&<Link prefetch={false} className="btn secondary" href={pageHref(status,page+1)}>{text.next}</Link>}</div></div>
    </>}
  </AdminShell>;
}
