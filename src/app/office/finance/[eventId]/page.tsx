import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission, canAccessEvent } from "@/lib/auth";
import { organizerFinanceEvent } from "@/lib/finance";
import { eventDate, money } from "@/lib/format";

export const dynamic="force-dynamic";

function dateTime(date:Date){return new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(date);}
function dateLabel(date:Date){return new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(date);}
function typeLabel(type:string){return type==="SALE"?"Продажа":type==="REFUND"?"Возврат":"Выплата";}

export default async function EventFinancePage({params}:{params:Promise<{eventId:string}>}){
  const {eventId}=await params;
  const staff=await requirePermission("FINANCE_VIEW");
  if(!canAccessEvent(staff,eventId))notFound();
  const data=await organizerFinanceEvent(staff.organizationId!,eventId);
  if(!data)notFound();
  const {event,transactions}=data;
  return <AdminShell>
    <div className="office-page-heading"><div><Link href="/office/finance" className="muted">← Все мероприятия</Link><span className="eyebrow" style={{display:"block",marginTop:12}}>Finance · {eventDate(event.eventStartsAt)}</span><h1>{event.eventTitle}</h1><p>Финансовый результат и движение средств по этому мероприятию.</p></div></div>
    <div className="stats">
      <div className="stat"><span className="muted">Продажи</span><strong>{money(event.salesMinor)}</strong><small>ваш доход от билетов</small></div>
      <div className="stat"><span className="muted">Возвраты</span><strong>{money(event.refundsMinor)}</strong><small>уменьшают ваш баланс</small></div>
      <div className="stat"><span className="muted">Текущий баланс</span><strong>{money(event.balanceMinor-event.paidOutMinor)}</strong><small>после возвратов и прошлых выплат</small></div>
      <div className="stat"><span className="muted">Уже выплачено</span><strong>{money(event.paidOutMinor)}</strong><small>по этому мероприятию</small></div>
    </div>

    <section className="panel" style={{marginBottom:20}}><div className="row between" style={{alignItems:"stretch",gap:16,flexWrap:"wrap"}}>
      <div style={{flex:"1 1 260px",padding:16,border:"1px solid #dbe7dc",borderRadius:14,background:"#f6fff8"}}><span className="muted">Доступно к выплате</span><h2 style={{margin:"6px 0",color:"#15803d"}}>{money(event.availableMinor)}</h2><small>Средства уже поступили Atlas и мероприятие завершено.</small></div>
      <div style={{flex:"1 1 260px",padding:16,border:"1px solid #f0dfb8",borderRadius:14,background:"#fffaf0"}}><span className="muted">Ожидает поступления</span><h2 style={{margin:"6px 0",color:"#a16207"}}>{money(Math.max(0,event.awaitingSettlementMinor))}</h2><small>Будет учтено после следующего расчётного цикла 6-го числа.</small></div>
      <div style={{flex:"1 1 260px",padding:16,border:"1px solid #d9e4f8",borderRadius:14,background:"#f7faff"}}><span className="muted">Плановая выплата</span><h2 style={{margin:"6px 0",color:"#1d4ed8"}}>{dateLabel(event.payoutDate)}</h2><small>После проведения мероприятия и поступления соответствующих средств.</small></div>
    </div></section>

    <h2 className="section-title">Движение средств</h2>
    <div className="table-wrap"><table><thead><tr><th>Дата</th><th>Операция</th><th>Номер</th><th>Описание</th><th>Сумма</th></tr></thead><tbody>
      {transactions.map(tx=><tr key={`${tx.type}-${tx.id}`}><td>{dateTime(tx.createdAt)}</td><td><span className="pill">{typeLabel(tx.type)}</span></td><td><strong>{tx.publicId}</strong></td><td>{tx.description}</td><td style={{fontWeight:800,color:tx.amountMinor>=0?"#15803d":"#b42318"}}>{tx.amountMinor>=0?"+":""}{money(tx.amountMinor)}</td></tr>)}
      {!transactions.length&&<tr><td colSpan={5}>Операций пока нет.</td></tr>}
    </tbody></table></div>
    <section className="panel" style={{marginTop:20}}><strong>Как считается этот экран?</strong><p className="muted" style={{marginBottom:0}}>Продажи показывают только сумму, принадлежащую вашей организации. Внутренние комиссии Atlas здесь не отображаются. Возвраты и выплаты изменяют ваш текущий баланс.</p></section>
  </AdminShell>;
}
