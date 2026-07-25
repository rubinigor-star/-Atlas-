import {AdminShell} from "@/components/admin-shell";
import {CreateTourForm} from "@/components/create-tour-form";
import {requirePermission} from "@/lib/auth";
import {db} from "@/lib/db";

export default async function NewTour(){
  const staff=await requirePermission("EVENT_MANAGE");
  const events=await db.event.findMany({where:{organizationId:staff.organizationId!},include:{venue:true},orderBy:{startsAt:"asc"}});
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Tours</span><h1>Новый тур</h1><p>Объедините несколько городов и дат на одной странице, сохранив отдельные цены, площадки и билеты.</p></div></div><CreateTourForm events={events.map(event=>({id:event.id,title:event.title,city:event.venue.city,startsAt:event.startsAt.toISOString()}))}/></AdminShell>;
}
