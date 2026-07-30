import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform-shell";
import { OrganizerTermsForm } from "@/components/organizer-terms-form";
import { ensureDemoOrganizerPlatform } from "@/lib/auth";
import { getOrganizerTerms } from "@/lib/commercial-terms";
import { db } from "@/lib/db";
import { eventDate, money } from "@/lib/format";

export const dynamic="force-dynamic";

export default async function OrganizerCommercialCard({params}:{params:Promise<{id:string}>}){
  await ensureDemoOrganizerPlatform();
  const{id}=await params;
  const organization=await db.organization.findUnique({where:{id},include:{users:true,events:{include:{venue:true,categories:true,orders:{where:{status:"PAID"},select:{totalMinor:true}}},orderBy:{startsAt:"desc"}}}});
  if(!organization)notFound();
  const terms=await getOrganizerTerms(id);
  const revenue=organization.events.flatMap(event=>event.orders).reduce((sum,order)=>sum+order.totalMinor,0);
  const owner=organization.users.find(user=>user.staffRole==="OWNER")??organization.users[0];
  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Карточка организатора</span><h1>{organization.name}</h1><p>Платформенный уровень: владелец, договоры, комиссии, возвраты и все мероприятия организации.</p></div><Link className="btn secondary" href="/platform/organizers">Все организаторы</Link></div>
    <div className="stats"><div className="stat"><span className="muted">Владелец</span><strong style={{fontSize:20}}>{owner?.name??"Не назначен"}</strong><small>{owner?.email}</small></div><div className="stat"><span className="muted">Мероприятий</span><strong>{organization.events.length}</strong></div><div className="stat"><span className="muted">Продажи</span><strong>{money(revenue)}</strong></div><div className="stat"><span className="muted">Статус договора</span><strong style={{fontSize:20}}>Не загружен</strong><small>Тестовый режим</small></div></div>
    <OrganizerTermsForm organizationId={id} initial={{salesFeePercentBps:terms.salesFeePercentBps,salesFeeFixedMinor:terms.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer,refundsEnabled:terms.refundsEnabled,refundFeePercentBps:terms.refundFeePercentBps,refundFeeFixedMinor:terms.refundFeeFixedMinor,refundDeadlineHours:terms.refundDeadlineHours,transferRefundWindowDays:terms.transferRefundWindowDays}}/>
    <div className="platform-section-card"><div className="row between"><div><span className="eyebrow">Договоры</span><h2>Документы организатора</h2></div><span className="pill">Тестовый режим</span></div><p className="muted">Здесь будут храниться подписанный договор, приложения, банковские реквизиты и история версий. Сейчас документ ещё не загружен.</p><button className="btn secondary" disabled>Загрузить договор, следующий этап</button></div>
    <div className="row between"><h2 className="section-title">Мероприятия организатора</h2><Link href="/platform/events">Все мероприятия платформы →</Link></div>
    <div className="table-wrap"><table><thead><tr><th>Мероприятие</th><th>Дата и площадка</th><th>Статус</th><th>Продано</th><th>Выручка</th><th></th></tr></thead><tbody>{organization.events.map(event=>{const sold=event.categories.reduce((sum,category)=>sum+category.sold,0);const eventRevenue=event.orders.reduce((sum,order)=>sum+order.totalMinor,0);return <tr key={event.id}><td><strong>{event.title}</strong></td><td>{eventDate(event.startsAt)}<br/><small>{event.venue.name}, {event.venue.city}</small></td><td><span className="pill">{event.status}</span></td><td>{sold}</td><td>{money(eventRevenue)}</td><td><Link className="btn secondary" href={`/office/events/${event.id}`}>Открыть мероприятие</Link></td></tr>})}</tbody></table></div>
  </PlatformShell>;
}
