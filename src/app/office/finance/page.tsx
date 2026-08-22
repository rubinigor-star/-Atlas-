import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { organizerFinanceSummary } from "@/lib/finance";
import { money, eventDate } from "@/lib/format";
import { localeTag, resolveStaffLocale } from "@/lib/i18n";
import { officeFinanceCopy } from "@/lib/office-finance-i18n";

export const dynamic="force-dynamic";

export default async function FinancePage(){
  const staff=await requirePermission("FINANCE_VIEW");
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text=officeFinanceCopy[locale];
  const raw=await organizerFinanceSummary(staff.organizationId!);
  const events=raw.events.filter(event=>canAccessEvent(staff,event.eventId));
  const scoped=staff.eventScope!=="ALL";
  const sum=(key:"salesMinor"|"refundsMinor"|"servicesMinor"|"balanceMinor"|"paidOutMinor"|"availableMinor")=>events.reduce((total,event)=>total+event[key],0);
  const summary={...raw,events,salesMinor:scoped?sum("salesMinor"):raw.salesMinor,refundsMinor:scoped?sum("refundsMinor"):raw.refundsMinor,servicesMinor:scoped?sum("servicesMinor"):raw.servicesMinor,balanceMinor:scoped?sum("balanceMinor"):raw.balanceMinor,paidOutMinor:scoped?sum("paidOutMinor"):raw.paidOutMinor,availableMinor:scoped?sum("availableMinor"):raw.availableMinor,unallocatedServicesMinor:scoped?0:raw.unallocatedServicesMinor};
  const dateLabel=(date:Date)=>new Intl.DateTimeFormat(localeTag(locale),{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Jerusalem"}).format(date);
  const payoutLabel=(status:string)=>status==="PAID"?text.status.PAID:status==="AVAILABLE"?text.status.AVAILABLE:text.status.SCHEDULED;

  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{scoped?text.scopedDescription:text.description}</p></div></div>
    <div className="stats">
      <div className="stat"><span className="muted">{text.earned}</span><strong>{money(summary.salesMinor)}</strong><small>{text.earnedHelp}</small></div>
      <div className="stat"><span className="muted">{text.refunds}</span><strong>{money(summary.refundsMinor)}</strong><small>{text.refundsHelp}</small></div>
      <div className="stat"><span className="muted">{text.services}</span><strong>{money(summary.servicesMinor)}</strong><small>{text.servicesHelp}</small></div>
      <div className="stat"><span className="muted">{text.balance}</span><strong>{money(summary.balanceMinor-summary.paidOutMinor)}</strong><small>{text.balanceHelp}</small></div>
      <div className="stat"><span className="muted">{text.available}</span><strong>{money(summary.availableMinor)}</strong><small>{text.availableHelp}</small></div>
    </div>
    <section className="panel" style={{marginBottom:20}}><div className="row between" style={{gap:20,alignItems:"flex-start"}}><div><span className="eyebrow">{text.payoutRule}</span><h2 style={{margin:"6px 0"}}>{text.payoutCycle}</h2><p className="muted" style={{margin:0,maxWidth:780}}>{text.payoutDescription}</p></div><div className="pill">{text.noAdvance}</div></div></section>
    {summary.unallocatedServicesMinor>0&&<section className="panel" style={{marginBottom:20}}><strong>{text.unallocated}: {money(summary.unallocatedServicesMinor)}</strong><p className="muted" style={{marginBottom:0}}>{text.unallocatedHelp}</p></section>}
    <div className="row between" style={{marginBottom:12}}><div><h2 className="section-title" style={{marginBottom:4}}>{text.events}</h2><p className="muted" style={{margin:0}}>{text.eventsHelp}</p></div></div>
    <div className="table-wrap"><table><thead><tr>{text.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{summary.events.map(event=><tr key={event.eventId}><td><Link href={`/office/finance/${event.eventId}`}><strong>{event.eventTitle}</strong></Link></td><td>{eventDate(event.eventStartsAt)}</td><td><strong>{money(event.salesMinor)}</strong></td><td>{money(event.refundsMinor)}</td><td>{money(event.servicesMinor)}</td><td><strong>{money(event.balanceMinor-event.paidOutMinor)}</strong></td><td style={{color:event.availableMinor>0?"#15803d":undefined,fontWeight:700}}>{money(event.availableMinor)}</td><td>{money(Math.max(0,event.awaitingSettlementMinor))}</td><td>{dateLabel(event.payoutDate)}</td><td><span className="pill">{payoutLabel(event.status)}</span></td></tr>)}{!summary.events.length&&<tr><td colSpan={10}>{text.empty}</td></tr>}</tbody></table></div>
  </AdminShell>;
}
