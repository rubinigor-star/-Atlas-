import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformShell } from "@/components/platform-shell";
import { FinanceReportActions } from "@/components/finance-report-actions";
import { requirePlatformAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { organizerFinanceEvent } from "@/lib/finance";
import { eventDate, money } from "@/lib/format";

export const dynamic="force-dynamic";
function dateTime(date:Date){return new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Jerusalem"}).format(date);}
function typeLabel(type:string){return type==="SALE"?"Продажа":type==="REFUND"?"Возврат":type==="SERVICE"?"Услуга":"Выплата";}

export default async function PlatformEventReport({params}:{params:Promise<{eventId:string}>}){
  await requirePlatformAdmin();
  const {eventId}=await params;
  const source=await db.event.findUnique({where:{id:eventId},select:{organizationId:true,organization:{select:{name:true}}}});
  if(!source)notFound();
  const data=await organizerFinanceEvent(source.organizationId,eventId);
  if(!data)notFound();
  const {event,transactions}=data;
  return <PlatformShell>
    <div className="platform-heading"><div><Link href={`/platform/organizers/${source.organizationId}`} className="muted">← {source.organization.name}</Link><span className="eyebrow" style={{display:"block",marginTop:12}}>Отчёт организатора · {eventDate(event.eventStartsAt)}</span><h1>{event.eventTitle}</h1><p>Версия отчёта, которую можно показать организатору. Внутренние комиссии и маржа Atlas здесь намеренно не раскрываются.</p></div><FinanceReportActions eventId={eventId}/></div>
    <div className="stats"><div className="stat"><span className="muted">Заработок организатора</span><strong>{money(event.salesMinor)}</strong></div><div className="stat"><span className="muted">Возвраты</span><strong>{money(event.refundsMinor)}</strong></div><div className="stat"><span className="muted">Доп. сервисы</span><strong>{money(event.servicesMinor)}</strong></div><div className="stat"><span className="muted">Остаток</span><strong>{money(event.balanceMinor-event.paidOutMinor)}</strong><small>после уже произведённых выплат</small></div></div>
    <div className="platform-section-card"><div className="row between" style={{gap:18,flexWrap:"wrap"}}><div><span className="muted">Уже выплачено</span><h2>{money(event.paidOutMinor)}</h2></div><div><span className="muted">Доступно сейчас</span><h2>{money(event.availableMinor)}</h2></div><div><span className="muted">Ожидает settlement</span><h2>{money(Math.max(0,event.awaitingSettlementMinor))}</h2></div></div></div>
    <h2 className="section-title">Движение средств</h2><div className="table-wrap platform-table-fit"><table><thead><tr><th>Дата</th><th>Операция</th><th>Номер</th><th>Описание</th><th>Сумма</th></tr></thead><tbody>{transactions.map(tx=><tr key={`${tx.type}-${tx.id}`}><td>{dateTime(tx.createdAt)}</td><td>{typeLabel(tx.type)}</td><td><strong>{tx.publicId}</strong></td><td>{tx.description}</td><td style={{fontWeight:800,color:tx.amountMinor>=0?"#15803d":"#b42318"}}>{tx.amountMinor>=0?"+":""}{money(tx.amountMinor)}</td></tr>)}{!transactions.length&&<tr><td colSpan={5}>Операций пока нет.</td></tr>}</tbody></table></div>
  </PlatformShell>;
}
