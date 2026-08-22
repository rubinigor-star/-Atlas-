import {AdminShell} from "@/components/admin-shell";
import {CreateTourForm} from "@/components/create-tour-form";
import {requirePermission} from "@/lib/auth";
import {resolveStaffLocale} from "@/lib/i18n";
import {db} from "@/lib/db";

const copy={ru:{title:"Новый тур",help:"Объедините несколько городов и дат на одной странице, сохранив отдельные цены, площадки и билеты."},he:{title:"סיור חדש",help:"אחדו כמה ערים ותאריכים בעמוד אחד, תוך שמירה על מחירים, אולמות וכרטיסים נפרדים לכל מופע."},en:{title:"New tour",help:"Combine several cities and dates on one page while keeping pricing, venues and tickets separate for each show."}} as const;
export default async function NewTour(){const staff=await requirePermission("EVENT_MANAGE");const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});const text=copy[locale];const events=await db.event.findMany({where:{organizationId:staff.organizationId!},include:{venue:true},orderBy:{startsAt:"asc"}});return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Tours</span><h1>{text.title}</h1><p>{text.help}</p></div></div><CreateTourForm events={events.map(event=>({id:event.id,title:event.title,city:event.venue.city,startsAt:event.startsAt.toISOString()}))}/></AdminShell>}
