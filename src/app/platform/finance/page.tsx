import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";
import { requirePlatformAdmin } from "@/lib/auth";
import { platformFinanceSummary } from "@/lib/finance";
import { money } from "@/lib/format";

export const dynamic="force-dynamic";

export default async function PlatformFinancePage(){
  await requirePlatformAdmin();
  const summary=await platformFinanceSummary();
  const atlasRevenue=summary.atlasSalesFeeMinor+summary.atlasCancellationFeeMinor;
  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Atlas Finance Control</span><h1>Финансы платформы</h1><p>Внутренняя финансовая картина Atlas: комиссии, обязательства перед организаторами, возвраты и выплаты.</p></div><span className="platform-admin-badge">SUPER ADMIN</span></div>
    <div className="stats">
      <div className="stat"><span className="muted">Оплачено покупателями</span><strong>{money(summary.buyerPaidMinor)}</strong><small>фактический customer total</small></div>
      <div className="stat"><span className="muted">Доход Atlas</span><strong>{money(atlasRevenue)}</strong><small>продажи + комиссии возвратов</small></div>
      <div className="stat"><span className="muted">Обязательства организаторам</span><strong>{money(summary.organizerLiabilityMinor)}</strong><small>ещё не выплачено</small></div>
      <div className="stat"><span className="muted">Можно выплатить сейчас</span><strong>{money(summary.availableForPayoutMinor)}</strong><small>мероприятие прошло + средства поступили</small></div>
    </div>

    <div className="platform-card" style={{marginBottom:20}}><div className="row between"><div><span className="eyebrow">Доход Atlas</span><h2 style={{margin:"6px 0"}}>Структура комиссий</h2></div></div><div className="stats" style={{marginBottom:0}}><div className="stat"><span className="muted">Комиссии с продаж</span><strong>{money(summary.atlasSalesFeeMinor)}</strong></div><div className="stat"><span className="muted">Комиссии с возвратов</span><strong>{money(summary.atlasCancellationFeeMinor)}</strong></div><div className="stat"><span className="muted">Доп. сервисы</span><strong>0 ₪</strong><small>SMS billing подключим отдельным слоем</small></div></div></div>

    <div className="row between"><div><h2 className="section-title">Организаторы</h2><p className="muted">То, что видит только Atlas. В кабинете организатора комиссии не раскрываются.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Организатор</th><th>Мероприятий</th><th>Оплачено клиентами</th><th>Заработок организатора</th><th>Возвраты</th><th>Баланс</th><th>Доход Atlas</th><th>Доступно к выплате</th></tr></thead><tbody>
      {summary.organizations.map(org=><tr key={org.organizationId}><td><Link href={`/platform/organizers/${org.organizationId}`}><strong>{org.organizationName}</strong></Link></td><td>{org.eventCount}</td><td>{money(org.buyerPaidMinor)}</td><td>{money(org.salesMinor)}</td><td>{money(org.refundsMinor)}</td><td><strong>{money(org.balanceMinor)}</strong></td><td style={{fontWeight:700,color:"#15803d"}}>{money(org.atlasRevenueMinor)}</td><td>{money(org.availableMinor)}</td></tr>)}
      {!summary.organizations.length&&<tr><td colSpan={8}>Финансовых данных пока нет.</td></tr>}
    </tbody></table></div>

    <h2 className="section-title" style={{marginTop:28}}>Мероприятия и выплаты</h2>
    <div className="table-wrap"><table><thead><tr><th>Мероприятие</th><th>Организатор</th><th>Баланс организатора</th><th>Atlas fee продажи</th><th>Atlas fee возвраты</th><th>Доступно к выплате</th><th>Плановая дата</th></tr></thead><tbody>
      {summary.events.map(event=><tr key={event.eventId}><td><strong>{event.eventTitle}</strong></td><td>{event.organizationName}</td><td>{money(event.balanceMinor-event.paidOutMinor)}</td><td>{money(event.atlasSalesFeeMinor)}</td><td>{money(event.atlasCancellationFeeMinor)}</td><td>{money(event.availableMinor)}</td><td>{new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric"}).format(event.payoutDate)}</td></tr>)}
    </tbody></table></div>
  </PlatformShell>;
}
