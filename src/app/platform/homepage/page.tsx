import { PlatformShell } from "@/components/platform-shell";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { MarqueeEditor } from "./marquee-editor";

export const dynamic="force-dynamic";

type SelectedRow={eventId:string;position:number};

export default async function PlatformHomepage(){
  await requirePlatformAdmin();
  const [events,selected]=await Promise.all([
    db.event.findMany({where:{status:"PUBLISHED"},select:{id:true,title:true,startsAt:true,status:true,organization:{select:{name:true}}},orderBy:[{startsAt:"asc"},{title:"asc"}]}),
    db.$queryRawUnsafe<SelectedRow[]>(`SELECT "eventId","position" FROM "HomeMarqueeEvent" WHERE "active"=TRUE ORDER BY "position" ASC`),
  ]);
  const available=events.map(event=>({id:event.id,title:event.title,startsAt:event.startsAt.toISOString(),status:event.status,organization:event.organization.name}));
  const publishedIds=new Set(events.map(event=>event.id));
  const initialSelected=selected.map(row=>row.eventId).filter(id=>publishedIds.has(id));
  return <PlatformShell><div className="platform-heading"><div><span className="eyebrow">Главная страница</span><h1>Бегущая строка мероприятий</h1><p>Выберите опубликованные мероприятия и установите порядок их показа на главной странице Atlas.</p></div><span className="platform-admin-badge">SUPER ADMIN</span></div><MarqueeEditor available={available} initialSelected={initialSelected}/></PlatformShell>;
}
