import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";
import { ensureDemoOrganizerPlatform } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";

export const dynamic="force-dynamic";

export default async function PlatformEvents(){
  await ensureDemoOrganizerPlatform();
  const events=await db.event.findMany({include:{organization:true,venue:true,categories:true,orders:{where:{status:"PAID"},select:{totalMinor:true}}},orderBy:{startsAt:"desc"}});
  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Atlas Platform Admin</span><h1>Все мероприятия</h1><p>Полный список мероприятий всех организаторов платформы.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Мероприятие</th><th>Организатор</th><th>Дата и площадка</th><th>Статус</th><th>Продажи</th><th></th></tr></thead><tbody>{events.map(event=>{const revenue=event.orders.reduce((sum,order)=>sum+order.totalMinor,0);return <tr key={event.id}><td><strong>{event.title}</strong><br/><small>/{event.slug}</small></td><td><Link href={`/platform/organizers/${event.organizationId}`}>{event.organization.name}</Link></td><td>{eventDate(event.startsAt)}<br/><small>{event.venue.name}, {event.venue.city}</small></td><td><span className="pill">{event.status}</span></td><td>{money(revenue)}</td><td>{event.status==="PUBLISHED"&&<Link className="btn secondary" href={`/events/${event.slug}`} target="_blank">Открыть сайт</Link>}</td></tr>})}</tbody></table></div>
  </PlatformShell>;
}
