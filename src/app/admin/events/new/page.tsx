import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { NewEventEntry } from "@/components/new-event-entry";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewEvent(){
 const staff=await requirePermission("EVENT_MANAGE");
 const events=await db.event.findMany({where:{organizationId:staff.organizationId!},include:{venue:true},orderBy:{startsAt:"desc"},take:30});
 return <AdminShell><div className="row between"><div><span className="eyebrow">Events</span><h1>Новое мероприятие</h1><p className="muted">Создание, копирование и последующее редактирование работают в одном интерфейсе.</p></div><Link href="/office/tours/new" className="btn dark">+ Создать тур</Link></div><NewEventEntry events={events.map(event=>({id:event.id,title:event.title,startsAt:event.startsAt.toISOString(),venueName:event.venue.name,city:event.venue.city,address:event.venue.address}))}/></AdminShell>;
}
