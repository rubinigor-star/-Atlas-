import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { organizerFinanceSummary } from "@/lib/finance";
import { money, eventDate } from "@/lib/format";

export const dynamic="force-dynamic";

function payoutLabel(status:string){return status==="PAID"?"Выплачено":status==="AVAILABLE"?"Доступно":"Запланировано";}
function dateLabel(date:Date){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(date);}

export default async function FinancePage(){
  const staff=await requirePermission("FINANCE_VIEW");
  const summary=await organizerFinanceSummary(staff.organizationId!);
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Finance</span><h1>Финансы</h1><p>Ваши продажи, возвраты, баланс мероприятий и плановые выплаты.</p></div></div>
    <div className="stats">
      <div className="stat"><span className="muted">Всего заработано</span><strong>{money(summary.salesMinor)}</strong><small>сумма, принадлежащая вам</small></div>
      <div className="stat"><span className="muted">Возвраты</span><strong>{money(summary.refundsMinor)}</strong><small>уменьшают баланс</small></div>
      <div className="stat"><span className="muted">Текущий баланс</span><strong>{money(summary.balanceMinor-summary.paidOutMinor)}</strong><small>после возвратов и выплат</small></div>
      <div className="stat"><span className="muted">Доступно к выплате</span><strong>{money(summary.availableMinor)}</strong><small>только уже поступившие Atlas средства</small></div>
    </div>

    <section className="panel" style={{marginBottom:20}}>
      <div className="row between" style={{gap:20,alignItems:"flex-start"}}><div><span className="eyebrow">Правило выплат</span><h2 style={{margin:"6px 0"}}>Расчётный цикл Atlas</h2><p className="muted" style={{margin:0,maxWidth:780}}>Средства от платёжной системы учитываются 6-го числа. Стандартная выплата организатору планируется на 7-е число после проведения мероприятия. Atlas не выплачивает средства, которые ещё не поступили от платёжной системы.</p></div><div className="pill">Без предоплат</div></div>
    </section>

    <div className="row between" style={{marginBottom:12}}><div><h2 className="section-title" style={{marginBottom:4}}>Мероприятия</h2><p className="muted" style={{margin:0}}>Нажмите на мероприятие, чтобы открыть подробный финансовый отчёт.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Мероприятие</th><th>Дата</th><th>Продажи</th><th>Возвраты</th><th>Баланс</th><th>Доступно</th><th>Ожидает поступления</th><th>Следующая выплата</th><th>Статус</th></tr></thead><tbody>
      {summary.events.map(event=><tr key={event.eventId}><td><Link href={`/office/finance/${event.eventId}`}><strong>{event.eventTitle}</strong></Link></td><td>{eventDate(event.eventStartsAt)}</td><td><strong>{money(event.salesMinor)}</strong></td><td>{money(event.refundsMinor)}</td><td><strong>{money(event.balanceMinor-event.paidOutMinor)}</strong></td><td style={{color:event.availableMinor>0?"#15803d":undefined,fontWeight:700}}>{money(event.availableMinor)}</td><td>{money(Math.max(0,event.awaitingSettlementMinor))}</td><td>{dateLabel(event.payoutDate)}</td><td><span className="pill">{payoutLabel(event.status)}</span></td></tr>)}
      {!summary.events.length&&<tr><td colSpan={9}>Финансовых операций пока нет.</td></tr>}
    </tbody></table></div>
  </AdminShell>;
}
