import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";
import { getEventNumbers } from "@/lib/event-number";

export const dynamic = "force-dynamic";

type EventsPageProps = { searchParams: Promise<{ status?: string }> };

const statusLabels: Record<string, string> = { DRAFT:"Черновик", REVIEW:"На модерации", PENDING_REVIEW:"На модерации", PUBLISHED:"Опубликовано", COMPLETED:"Завершено", CANCELLED:"Отменено", ARCHIVED:"Архив" };
const filters = [{value:"all",label:"Все"},{value:"active",label:"Активные"},{value:"DRAFT",label:"Черновики"},{value:"PUBLISHED",label:"Опубликованные"},{value:"past",label:"Прошедшие"},{value:"CANCELLED",label:"Отменённые"}];
function isInactiveStatus(status:string){return status==="CANCELLED"||status==="ARCHIVED"}
function matchesFilter(event:{status:string;startsAt:Date},filter:string,now:Date){if(filter==="all")return true;if(filter==="active")return event.startsAt>=now&&!isInactiveStatus(event.status);if(filter==="past")return event.startsAt<now;return event.status===filter}

export default async function EventsPage({searchParams}:EventsPageProps){
  const staff=await requirePermission("EVENT_VIEW");
  const {status="all"}=await searchParams;
  const now=new Date();
  const events=await db.event.findMany({where:{organizationId:staff.organizationId!},include:{venue:true,categories:{select:{capacity:true,sold:true,priceMinor:true}},orders:{where:{status:"PAID"},select:{totalMinor:true}}},orderBy:[{startsAt:"desc"},{createdAt:"desc"}]});
  const visibleEvents=events.filter(event=>canAccessEvent(staff,event.id));
  const eventNumbers=await getEventNumbers(visibleEvents.map(event=>event.id));
  const filteredEvents=visibleEvents.filter(event=>matchesFilter(event,status,now));
  return <AdminShell>
    <div className="row between"><div><span className="eyebrow">Organizer back-office</span><h1>Мероприятия</h1><p className="muted">Все мероприятия организации — опубликованные, черновики и завершённые.</p></div>{staff.permissionSet.has("EVENT_MANAGE")&&<Link href="/office/events/new" className="btn">+ Создать мероприятие</Link>}</div>
    <div className="row" style={{flexWrap:"wrap",gap:8,margin:"22px 0"}}>{filters.map(filter=><Link key={filter.value} href={filter.value==="all"?"/office/events":`/office/events?status=${encodeURIComponent(filter.value)}`} className={status===filter.value?"btn dark":"btn secondary"}>{filter.label}</Link>)}</div>
    <div className="stats"><div className="stat"><span className="muted">Всего мероприятий</span><strong>{visibleEvents.length}</strong></div><div className="stat"><span className="muted">Опубликовано</span><strong>{visibleEvents.filter(event=>event.status==="PUBLISHED").length}</strong></div><div className="stat"><span className="muted">Предстоящие</span><strong>{visibleEvents.filter(event=>event.startsAt>=now&&!isInactiveStatus(String(event.status))).length}</strong></div></div>
    {filteredEvents.length===0?<div className="panel" style={{marginTop:24}}><h2>Мероприятий в этом разделе нет</h2><p className="muted">Выберите другой фильтр или создайте новое мероприятие.</p></div>:<div className="table-wrap" style={{marginTop:24}}><table><thead><tr><th>Номер</th><th>Мероприятие</th><th>Дата и площадка</th><th>Статус</th><th>Продажи</th><th>Выручка</th><th></th></tr></thead><tbody>{filteredEvents.map(event=>{const sold=event.categories.reduce((sum,c)=>sum+c.sold,0);const capacity=event.categories.reduce((sum,c)=>sum+c.capacity,0);const revenue=event.orders.reduce((sum,o)=>sum+o.totalMinor,0);return <tr key={event.id}><td><strong>{eventNumbers.get(event.id)}</strong></td><td><strong>{event.title}</strong><br/><small>/{event.slug}</small></td><td>{eventDate(event.startsAt)}<br/><small>{event.venue.name}, {event.venue.city}</small></td><td><span className="pill">{statusLabels[event.status]??event.status}</span></td><td>{sold} / {capacity}</td><td>{money(revenue)}</td><td><div className="row" style={{justifyContent:"flex-end",gap:8}}>{event.status==="PUBLISHED"&&<Link className="btn secondary" href={`/events/${event.slug}`} target="_blank">Открыть сайт</Link>}<Link className="btn" href={`/office/events/${event.id}`}>{staff.permissionSet.has("EVENT_MANAGE")?"Управлять":"Открыть"}</Link></div></td></tr>})}</tbody></table></div>}
  </AdminShell>
}
