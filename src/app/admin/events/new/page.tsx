import { AdminShell } from "@/components/admin-shell";
import { CreateEventForm } from "@/components/create-event-form";
import { CloneEventForm } from "@/components/clone-event-form";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function NewEvent(){
  const staff=await requirePermission("EVENT_MANAGE");
  const events=await db.event.findMany({where:{organizationId:staff.organizationId!},include:{venue:true},orderBy:{startsAt:"desc"},take:30});
  return <AdminShell><span className="eyebrow">Events</span><h1>Новое мероприятие</h1><p className="muted">Создайте мероприятие с нуля или скопируйте готовую архитектуру предыдущего вечера.</p><details className="panel" open><summary><strong>Создать с нуля</strong></summary><CreateEventForm/></details><details className="panel" style={{marginTop:20}}><summary><strong>Скопировать существующее</strong></summary><CloneEventForm events={events.map(event=>({id:event.id,title:event.title,startsAt:event.startsAt.toISOString(),venueName:event.venue.name,city:event.venue.city,address:event.venue.address}))}/></details></AdminShell>;
}
