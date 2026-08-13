import { AdminShell } from "@/components/admin-shell";
import { OrganizerTermsForm } from "@/components/organizer-terms-form";
import { requirePermission } from "@/lib/auth";
import { getOrganizerTerms } from "@/lib/commercial-terms";
import { contractReference, getOrganizerCompliance, payoutReadiness } from "@/lib/organizer-compliance";

export const dynamic="force-dynamic";

function dateLabel(date:Date|null){return date?new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"}).format(date):"-";}

export default async function OrganizerCompanyPage(){
  const staff=await requirePermission("FINANCE_VIEW");
  const organizationId=staff.organizationId!;
  const [terms,compliance]=await Promise.all([getOrganizerTerms(organizationId),getOrganizerCompliance(organizationId)]);
  const readiness=payoutReadiness(compliance);
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Компания и договор</span><h1>{staff.organization?.name}</h1><p>Действующие условия Atlas, сохранённый договор и готовность документов для будущих выплат.</p></div><span className="pill">Организатор</span></div>
    <div className="stats"><div className="stat"><span className="muted">Роль</span><strong style={{fontSize:20}}>Владелец кабинета</strong></div><div className="stat"><span className="muted">Статус договора</span><strong style={{fontSize:20,color:compliance.agreementStatus==="ACCEPTED"?"#15803d":"#b42318"}}>{compliance.agreementStatus==="ACCEPTED"?"Подписан":"Требуется"}</strong><small>{compliance.agreementStatus==="ACCEPTED"?contractReference(organizationId,compliance.acceptedAt):"Договор ещё не принят"}</small></div><div className="stat"><span className="muted">Готовность к выплатам</span><strong style={{fontSize:20,color:readiness.ready?"#15803d":"#a16207"}}>{readiness.ready?"Готов":"Нужны документы"}</strong><small>Регистрацию это не блокирует</small></div></div>
    <OrganizerTermsForm organizationId={organizationId} readOnly initial={{salesFeePercentBps:terms.salesFeePercentBps,salesFeeFixedMinor:terms.salesFeeFixedMinor,serviceFeePayer:terms.serviceFeePayer,refundsEnabled:terms.refundsEnabled,refundFeePercentBps:terms.refundFeePercentBps,refundFeeFixedMinor:terms.refundFeeFixedMinor,refundDeadlineHours:terms.refundDeadlineHours,transferRefundWindowDays:terms.transferRefundWindowDays}}/>
    <section className="platform-section-card"><span className="eyebrow">Договор и выплаты</span><h2>Документы компании</h2><div className="platform-readiness-grid">{readiness.checks.map(check=><div key={check.key} className={`platform-readiness-item ${check.ready?"ready":"missing"}`}><b>{check.ready?"✓":"!"}</b><div><strong>{check.label}</strong><small>{check.ready?"Готово":"Потребуется до выплаты"}</small></div></div>)}</div>
      {compliance.agreementStatus==="ACCEPTED"?<div className="platform-contract-card"><div><strong>{compliance.agreementTitle}</strong><small>{contractReference(organizationId,compliance.acceptedAt)} · версия {compliance.agreementVersion}</small></div><div><span>Подписал: {compliance.acceptedByName} · {compliance.acceptedByEmail}</span><small>{dateLabel(compliance.acceptedAt)}</small></div><details><summary>Открыть сохранённую версию договора</summary><pre>{compliance.agreementText}</pre></details></div>:<div className="toast">Для этой старой организации в системе нет зафиксированного принятия договора. Новые организаторы подписывают договор при регистрации.</div>}
      {!readiness.ready&&<p className="muted">Банковские реквизиты и ניכוי מס במקור можно добавить после регистрации. До их проверки Atlas не позволит финально зафиксировать выплату.</p>}
    </section>
  </AdminShell>;
}
