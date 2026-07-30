import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PlatformShell } from "@/components/platform-shell";
import { ensureDemoOrganizerPlatform, requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";
import { getSearchShowcaseEventIds, SEARCH_SHOWCASE_LIMIT, setSearchShowcaseEvent } from "@/lib/search-showcase";

export const dynamic="force-dynamic";

async function updateSearchShowcase(formData:FormData){
  "use server";
  await requirePlatformAdmin();
  const eventId=String(formData.get("eventId")??"");
  const featured=String(formData.get("featured")??"")==="true";
  if(!eventId)return;
  await setSearchShowcaseEvent(eventId,featured);
  revalidatePath("/platform/events");
  revalidatePath("/");
}

export default async function PlatformEvents(){
  await ensureDemoOrganizerPlatform();
  const [events,featuredEventIds]=await Promise.all([
    db.event.findMany({include:{organization:true,venue:true,categories:true,orders:{where:{status:"PAID"},select:{totalMinor:true}}},orderBy:{startsAt:"desc"}}),
    getSearchShowcaseEventIds(),
  ]);
  const featuredSet=new Set(featuredEventIds);
  const showcaseFull=featuredEventIds.length>=SEARCH_SHOWCASE_LIMIT;

  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Atlas Platform Admin</span><h1>Все мероприятия</h1><p>Полный список мероприятий всех организаторов платформы. Здесь же выбираются квадратные карточки для блока «Популярные мероприятия» в поиске.</p></div><span className="platform-admin-badge">В ПОИСКЕ {featuredEventIds.length}/{SEARCH_SHOWCASE_LIMIT}</span></div>
    <div className="table-wrap"><table><thead><tr><th>Мероприятие</th><th>Организатор</th><th>Дата и площадка</th><th>Статус</th><th>Продажи</th><th>Популярное в поиске</th><th></th></tr></thead><tbody>{events.map(event=>{const revenue=event.orders.reduce((sum,order)=>sum+order.totalMinor,0);const featured=featuredSet.has(event.id);const cannotAdd=event.status!=="PUBLISHED"||(!featured&&showcaseFull);return <tr key={event.id}><td><strong>{event.title}</strong><br/><small>/{event.slug}</small></td><td><Link href={`/platform/organizers/${event.organizationId}`}>{event.organization.name}</Link></td><td>{eventDate(event.startsAt)}<br/><small>{event.venue.name}, {event.venue.city}</small></td><td><span className="pill">{event.status}</span></td><td>{money(revenue)}</td><td><form action={updateSearchShowcase}><input type="hidden" name="eventId" value={event.id}/><input type="hidden" name="featured" value={featured?"false":"true"}/><button className={featured?"btn":"btn secondary"} type="submit" disabled={cannotAdd}>{featured?"Убрать из популярных":showcaseFull?"Выбрано 8 из 8":"Добавить в популярные"}</button></form></td><td>{event.status==="PUBLISHED"&&<Link className="btn secondary" href={`/events/${event.slug}`} target="_blank">Открыть сайт</Link>}</td></tr>})}</tbody></table></div>
  </PlatformShell>;
}
