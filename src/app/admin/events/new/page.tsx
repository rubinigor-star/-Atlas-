import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { NewEventEntry } from "@/components/new-event-entry";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveStaffLocale } from "@/lib/i18n";

const copy={ru:{title:"Новое мероприятие",help:"Создание, копирование и последующее редактирование работают в одном интерфейсе.",tour:"+ Создать тур"},he:{title:"אירוע חדש",help:"יצירה, שכפול ועריכה בהמשך מתבצעים באותו ממשק.",tour:"+ יצירת סיבוב הופעות"},en:{title:"New event",help:"Creation, duplication, and later editing all use the same interface.",tour:"+ Create tour"}} as const;
export default async function NewEvent(){const staff=await requirePermission("EVENT_MANAGE");const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});const text=copy[locale];const events=await db.event.findMany({where:{organizationId:staff.organizationId!},include:{venue:true},orderBy:{startsAt:"desc"},take:30});return <AdminShell><div className="row between"><div><span className="eyebrow">Events</span><h1>{text.title}</h1><p className="muted">{text.help}</p></div><Link href="/office/tours/new" className="btn dark">{text.tour}</Link></div><NewEventEntry events={events.map(event=>({id:event.id,title:event.title,startsAt:event.startsAt.toISOString(),venueName:event.venue.name,city:event.venue.city,address:event.venue.address}))}/></AdminShell>;}
