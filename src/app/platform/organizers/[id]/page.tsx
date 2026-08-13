import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform-shell";
import { OrganizerTermsForm } from "@/components/organizer-terms-form";
import { PlatformOrganizerProfileForm } from "@/components/platform-organizer-profile-form";
import { requirePlatformAdmin } from "@/lib/auth";
import { getOrganizerTerms } from "@/lib/commercial-terms";
import { db } from "@/lib/db";
import { organizerFinanceSummary } from "@/lib/finance";
import { contractReference, getOrganizerCompliance, payoutReadiness } from "@/lib/organizer-compliance";
import { eventDate, money } from "@/lib/format";

export const dynamic="force-dynamic";

function acceptedDate(date:Date|null){return date?new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"}).format(date):"-";}

export default async function OrganizerCommercialCard({params}:{params:Promise<{id:string}>}){
  await requirePlatformAdmin();
  const{id}=await params;
  const organization=await db.organization.findUnique({where:{id},include:{users:true,events:{include:{venue:true,categories:true},orderBy:{startsAt:"desc"}}}});
  if(!organization)notFound();
  const [terms,compliance,finance]=await Promise.all([getOrganizerTerms(id),getOrganizerCompliance(id),organizerFinanceSummary(id)]);
  const readiness=payoutReadiness(compliance);
  const owner=organization.users.find(user=>user.staffRole==="OWNER")??organization.users[0];
  const financeByEvent=new Map(finance.events.map(event=>[event.eventId,event]));
  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Карточка организатора</span><h1>{organization.name}</h1><p>Владелец, договор, коммерческие условия, документы для выплат, финансы и отчёты по всем мероприятиям организации.</p></div><Link className="btn secondary" href="/platform/organizers">Все организаторы</Link></div>
    <div className="stats">
      <div className="stat"><span className="muted">Владелец</span><strong style={{fontSize:20}}>{owner?.name??"Не назначен"}</strong><small>{owner?.email??""}</small></div>
      <div className="stat"><span className="muted">Мероприятий</span><strong>{organization.events.length}</strong></div>
      <div className="stat"><span className="muted">Баланс организатора</span><strong>{money(finance.balanceMinor-finance.paidOutMinor)}</strong><small>после возвратов, сервисов и выплат</small></div>
      <div className="stat"><span className="muted">Статус договора</span><strong style={{fontSize:20,color:compliance.agreementStatus==="ACCEPTED"?"#15803d":"#b42318"}}>{compliance.agreementStatus==="ACCEPTED"?"Подписан":"Не подписан"}</strong><small>{compliance.agreementStatus==="ACCEPTED"?contractReference(id,compliance.acceptedAt):"Требуется принятие договора"}</small></div>
    </div>

    <PlatformOrganizerProfileForm organizationId={id} initial={{organizationName:organization.name,ownerName:owner?.name??"",ownerEmail:owner?.email??"",businessType:compliance.businessType??"",country:compliance.country??"",phone:compliance.phone??"",bankAccountLabel:compliance.bankAccountLabel??"",taxDocumentLabel:compliance.taxDocumentLabel??""}}/>

    <section className="platform-section-card">
      <div className="row between" style={{alignItems:"flex-start",gap:18,flexWrap:"wrap"}}><div><span className="eyebrow">Договор и compliance</span><h2>Готовность организатора</h2><p className="muted">Организатор может зарегистрироваться и продавать без банковских и налоговых документов. Выплата становится операционно готовой только после завершения checklist.</p></div><span className="pill" style={{background:readiness.ready?"#e8f8ef":"#fff3d6",color:readiness.ready?"#15803d":"#966400"}}>{readiness.ready?"Готов к выплатам":"Документы не завершены"}</span></div>
      <div className="platform-readiness-grid">{readiness.checks.map(check=><div key={check.key} className={`platform-readiness-item ${check.ready?"ready":"missing"}`}><b>{check.ready?"✓":"!"}</b><div><strong>{check.label}</strong><small>{check.ready?"Готово":"Требуется до первой выплаты"}</small></div></div>)}</div>
      {compliance.agreementStatus==="ACCEPTED"&&<div className="platform-contract-card"><div><strong>{compliance.agreementTitle}</strong><small>{contractReference(id,compliance.acceptedAt)} · версия {compliance.agreementVersion}</small></div><div><span>Принял: {compliance.acceptedByName} · {compliance.acceptedByEmail}</span><small>{acceptedDate(compliance.acceptedAt)} · SHA-256 {compliance.agreementHash?.slice(0,16)}...</small></div><details><summary>Показать сохранённый текст договора</summary><pre>{compliance.agreementText}</pre></details></div>}
    </section>

    <OrganizerTermsForm organizationId={id} initial={{salesFeePercentBps:terms.salesFeePercentBps,salesFeeFixedMinor:terms.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer,refundsEnabled:terms.refundsEnabled,refundFeePercentBps:terms.refundFeePercentBps,refundFeeFixedMinor:terms.refundFeeFixedMinor,refundDeadlineHours:terms.refundDeadlineHours,transferRefundWindowDays:terms.transferRefundWindowDays}}/>

    <div className="row between"><div><h2 className="section-title">Мероприятия организатора</h2><p className="muted">Финансовый отчёт можно открыть, распечатать в PDF или скачать CSV.</p></div><Link href="/platform/events">Все мероприятия платформы →</Link></div>
    <div className="table-wrap platform-table-fit"><table><thead><tr><th>Мероприятие</th><th>Дата и площадка</th><th>Продано</th><th>Заработок</th><th>Возвраты</th><th>Баланс</th><th>Отчёт</th></tr></thead><tbody>{organization.events.map(event=>{const sold=event.categories.reduce((sum,category)=>sum+category.sold,0);const f=financeByEvent.get(event.id);return <tr key={event.id}><td><strong>{event.title}</strong><br/><small>{event.status}</small></td><td>{eventDate(event.startsAt)}<br/><small>{event.venue.name}, {event.venue.city}</small></td><td>{sold}</td><td>{money(f?.salesMinor??0)}</td><td>{money(f?.refundsMinor??0)}</td><td><strong>{money((f?.balanceMinor??0)-(f?.paidOutMinor??0))}</strong></td><td><div className="row" style={{flexWrap:"wrap"}}><Link className="btn secondary" href={`/platform/reports/events/${event.id}`}>Открыть отчёт</Link><a className="btn secondary" href={`/api/finance/events/${event.id}/report.csv`}>CSV</a></div></td></tr>})}</tbody></table></div>
  </PlatformShell>;
}
