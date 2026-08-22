import {PlatformShell} from "@/components/platform-shell";
import {requirePlatformAdmin} from "@/lib/auth";
import {db} from "@/lib/db";
import {MarqueeEditor} from "./marquee-editor";
import {getServerI18n} from "@/lib/server-locale";

export const dynamic="force-dynamic";
type SelectedRow={eventId:string;position:number};
const copy={ru:{eyebrow:"Главная страница",title:"Бегущая строка мероприятий",help:"Выберите опубликованные мероприятия и установите порядок их показа на главной странице Atlas."},he:{eyebrow:"עמוד הבית",title:"שורת אירועים מתחלפת",help:"בחרו אירועים שפורסמו וקבעו את סדר ההצגה שלהם בעמוד הבית של Atlas."},en:{eyebrow:"Homepage",title:"Event marquee",help:"Select published events and set the order in which they appear on the Atlas homepage."}} as const;
export default async function PlatformHomepage(){await requirePlatformAdmin();const[{locale},events,selected]=await Promise.all([getServerI18n(),db.event.findMany({where:{status:"PUBLISHED"},select:{id:true,title:true,startsAt:true,status:true,organization:{select:{name:true}}},orderBy:[{startsAt:"asc"},{title:"asc"}]}),db.$queryRawUnsafe<SelectedRow[]>(`SELECT "eventId","position" FROM "HomeMarqueeEvent" WHERE "active"=TRUE ORDER BY "position" ASC`)]);const t=copy[locale];const available=events.map(event=>({id:event.id,title:event.title,startsAt:event.startsAt.toISOString(),status:event.status,organization:event.organization.name}));const publishedIds=new Set(events.map(event=>event.id));const initialSelected=selected.map(row=>row.eventId).filter(id=>publishedIds.has(id));return <PlatformShell><div className="platform-heading"><div><span className="eyebrow">{t.eyebrow}</span><h1>{t.title}</h1><p>{t.help}</p></div><span className="platform-admin-badge">SUPER ADMIN</span></div><MarqueeEditor available={available} initialSelected={initialSelected}/></PlatformShell>}
