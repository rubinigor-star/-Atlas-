import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformPayoutForm } from "@/components/platform-payout-form";
import { requirePlatformAdmin } from "@/lib/auth";
import { platformFinanceSummary } from "@/lib/finance";
import { platformFinanceAuditOperations, type PlatformFinanceAuditOperation } from "@/lib/platform-finance-audit";
import { money } from "@/lib/format";

export const dynamic="force-dynamic";

type Metric = "buyer"|"atlasRevenue"|"liability"|"available"|"organizerSales"|"refunds"|"services"|"balance"|"salesFee"|"cancellationFee";
type SearchParams = Promise<Record<string,string|string[]|undefined>>;

const metricLabels: Record<Metric,string> = {
  buyer:"Оплачено покупателями",
  atlasRevenue:"Доход Atlas",
  liability:"Обязательства организаторам",
  available:"Можно выплатить сейчас",
  organizerSales:"Заработок организатора",
  refunds:"Возвраты и отмены",
  services:"Дополнительные сервисы",
  balance:"Баланс организатора",
  salesFee:"Комиссии Atlas с продаж",
  cancellationFee:"Комиссии Atlas с отмен",
};

function one(value: string|string[]|undefined){return Array.isArray(value)?value[0]:value;}
function isMetric(value: string|undefined): value is Metric{return Boolean(value&&value in metricLabels);}
function detailHref(metric:Metric,organizationId?:string,eventId?:string){
  const q=new URLSearchParams({metric});
  if(organizationId) q.set("org",organizationId);
  if(eventId) q.set("event",eventId);
  return `/platform/finance?${q.toString()}#finance-detail`;
}
function MoneyLink({amount,metric,org,event,strong=false}:{amount:number;metric:Metric;org?:string;event?:string;strong?:boolean}){
  return <Link href={detailHref(metric,org,event)} style={{fontWeight:strong?800:700,color:"inherit",textDecoration:"underline",textDecorationStyle:"dotted",textUnderlineOffset:4,cursor:"pointer"}} title="Открыть расчёт">{money(amount)}</Link>;
}
function signedMoney(amount:number){return `${amount>=0?"+":""}${money(amount)}`;}
function eventOutstanding(event:{balanceMinor:number;paidOutMinor:number}){return event.balanceMinor-event.paidOutMinor;}

function operationSign(metric:Metric,op:PlatformFinanceAuditOperation){
  if(metric==="balance"||metric==="liability"){
    if(op.kind==="ORGANIZER_SALE") return 1;
    if(op.kind==="REFUND"||op.kind==="ATLAS_CANCELLATION_FEE"||op.kind==="SERVICE_SMS"||op.kind==="PAYOUT") return -1;
  }
  return 1;
}
function relevantKinds(metric:Metric){
  switch(metric){
    case "buyer": return ["BUYER_PAYMENT"];
    case "atlasRevenue": return ["ATLAS_SALES_FEE","ATLAS_CANCELLATION_FEE","SERVICE_SMS"];
    case "liability": return ["ORGANIZER_SALE","REFUND","ATLAS_CANCELLATION_FEE","SERVICE_SMS","PAYOUT"];
    case "organizerSales": return ["ORGANIZER_SALE"];
    case "refunds": return ["REFUND","ATLAS_CANCELLATION_FEE"];
    case "services": return ["SERVICE_SMS"];
    case "balance": return ["ORGANIZER_SALE","REFUND","ATLAS_CANCELLATION_FEE","SERVICE_SMS"];
    case "salesFee": return ["ATLAS_SALES_FEE"];
    case "cancellationFee": return ["ATLAS_CANCELLATION_FEE"];
    case "available": return [];
  }
}
function formula(metric:Metric){
  switch(metric){
    case "buyer": return "Сумма фактически оплаченных customer total по всем успешным продажам.";
    case "atlasRevenue": return "Доход Atlas = комиссия с продаж + комиссия с отмен + платные дополнительные сервисы.";
    case "liability": return "Обязательство = заработок организаторов - возвраты клиентам - комиссии отмен - платные сервисы - уже зафиксированные выплаты.";
    case "available": return "Доступно сейчас = только положительный остаток после наступления payout-cycle, с учётом settlement, прошлых выплат и долгов организатора по другим мероприятиям.";
    case "organizerSales": return "Заработок организатора = сумма organizer net, зафиксированная в OrderCommercialSnapshot каждой продажи.";
    case "refunds": return "Нагрузка возврата на организатора = фактически возвращено клиенту + комиссия Atlas за отмену. Sales fee Atlas при этом не аннулируется.";
    case "services": return "Сервисы = только платные дополнительные SMS. Первая автоматическая SMS с билетом и её автоматический retry стоят 0 ₪.";
    case "balance": return "Баланс = заработок организатора - фактические возвраты клиентам - комиссии отмен - платные дополнительные сервисы.";
    case "salesFee": return "Комиссия с продажи фиксируется при успешной продаже и остаётся доходом Atlas даже при последующей отмене.";
    case "cancellationFee": return "Комиссия отмены начисляется отдельно от комиссии первоначальной продажи.";
  }
}

export default async function PlatformFinancePage({searchParams}:{searchParams:SearchParams}){
  await requirePlatformAdmin();
  const params=await searchParams;
  const requestedMetric=one(params.metric);
  const metric=isMetric(requestedMetric)?requestedMetric:null;
  const selectedOrg=one(params.org);
  const selectedEvent=one(params.event);
  const [summary,operations]=await Promise.all([
    platformFinanceSummary(),
    metric&&metric!=="available"?platformFinanceAuditOperations():Promise.resolve([]),
  ]);
  const atlasRevenue=summary.atlasSalesFeeMinor+summary.atlasCancellationFeeMinor+summary.atlasServicesMinor;
  const paidOutByOrg=new Map<string,number>();
  for(const event of summary.events) paidOutByOrg.set(event.organizationId,(paidOutByOrg.get(event.organizationId)||0)+event.paidOutMinor);
  const filteredOps=operations.filter(op=>(!selectedOrg||op.organizationId===selectedOrg)&&(!selectedEvent||op.eventId===selectedEvent));
  const detailOps=metric?filteredOps.filter(op=>relevantKinds(metric).includes(op.kind)):[];
  const selectedOrgRow=selectedOrg?summary.organizations.find(org=>org.organizationId===selectedOrg):undefined;
  const selectedEventRow=selectedEvent?summary.events.find(event=>event.eventId===selectedEvent):undefined;
  const scopeLabel=selectedEventRow?`${selectedEventRow.organizationName} · ${selectedEventRow.eventTitle}`:selectedOrgRow?.organizationName||"Вся платформа";
  const availableEvents=summary.events.filter(event=>(!selectedOrg||event.organizationId===selectedOrg)&&(!selectedEvent||event.eventId===selectedEvent));

  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Atlas Finance Control</span><h1>Финансы платформы</h1><p>Каждая денежная цифра раскрывается до формулы, мероприятия, заказа, возврата, комиссии, SMS или выплаты.</p></div><span className="platform-admin-badge">SUPER ADMIN</span></div>
    <div className="stats">
      <div className="stat"><span className="muted">Оплачено покупателями</span><strong><MoneyLink amount={summary.buyerPaidMinor} metric="buyer"/></strong><small>нажмите, чтобы увидеть все платежи</small></div>
      <div className="stat"><span className="muted">Доход Atlas</span><strong><MoneyLink amount={atlasRevenue} metric="atlasRevenue"/></strong><small>продажи + отмены + сервисы</small></div>
      <div className="stat"><span className="muted">Обязательства организаторам</span><strong><MoneyLink amount={summary.organizerLiabilityMinor} metric="liability"/></strong><small>после возвратов, сервисов и выплат</small></div>
      <div className="stat"><span className="muted">Можно выплатить сейчас</span><strong><MoneyLink amount={summary.availableForPayoutMinor} metric="available"/></strong><small>только наступившие payout-cycle</small></div>
    </div>

    {metric&&<div id="finance-detail" className="platform-card" style={{marginBottom:24,border:"2px solid #111827"}}>
      <div className="row between" style={{alignItems:"flex-start",gap:16}}><div><span className="eyebrow">Как рассчитано</span><h2 style={{margin:"6px 0"}}>{metricLabels[metric]}</h2><p className="muted" style={{margin:"0 0 6px"}}>{scopeLabel}</p><p style={{margin:0,maxWidth:900}}>{formula(metric)}</p></div><Link href="/platform/finance" className="button secondary">Закрыть</Link></div>
      {metric==="available"?<div className="table-wrap" style={{marginTop:18}}><table><thead><tr><th>Организатор</th><th>Мероприятие</th><th>Баланс до выплат</th><th>Уже выплачено</th><th>Доступно сейчас</th><th>Payout-cycle</th></tr></thead><tbody>{availableEvents.map(event=><tr key={event.eventId}><td>{event.organizationName}</td><td>{event.eventTitle}</td><td>{money(event.balanceMinor)}</td><td>{money(event.paidOutMinor)}</td><td><strong>{money(event.availableMinor)}</strong></td><td>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Jerusalem"}).format(event.payoutDate)}</td></tr>)}</tbody></table></div>:
      <><div className="table-wrap" style={{marginTop:18}}><table><thead><tr><th>Дата</th><th>Организатор</th><th>Мероприятие</th><th>Заказ / операция</th><th>Что произошло</th><th>В расчёте</th></tr></thead><tbody>{detailOps.slice(0,500).map(op=>{const sign=operationSign(metric,op);return <tr key={op.id}><td>{new Intl.DateTimeFormat("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"Asia/Jerusalem"}).format(op.createdAt)}</td><td>{op.organizationName}</td><td>{op.eventTitle||"-"}</td><td>{op.publicId||"-"}</td><td>{op.description}</td><td style={{fontWeight:800,color:sign<0?"#b91c1c":"#15803d"}}>{signedMoney(op.amountMinor*sign)}</td></tr>})}{!detailOps.length&&<tr><td colSpan={6}>Операций для этой суммы нет.</td></tr>}</tbody></table></div>{detailOps.length>500&&<p className="muted">Показаны первые 500 операций из {detailOps.length}. Сумма наверху включает все операции.</p>}</>}
    </div>}

    <div className="platform-card" style={{marginBottom:20}}><div className="row between"><div><span className="eyebrow">Доход Atlas</span><h2 style={{margin:"6px 0"}}>Структура дохода</h2></div></div><div className="stats" style={{marginBottom:0}}><div className="stat"><span className="muted">Комиссии с продаж</span><strong><MoneyLink amount={summary.atlasSalesFeeMinor} metric="salesFee"/></strong><small>не исчезают при отмене</small></div><div className="stat"><span className="muted">Комиссии с отмен</span><strong><MoneyLink amount={summary.atlasCancellationFeeMinor} metric="cancellationFee"/></strong><small>отдельный доход Atlas</small></div><div className="stat"><span className="muted">Доп. сервисы</span><strong><MoneyLink amount={summary.atlasServicesMinor} metric="services"/></strong><small>только платные повторные SMS</small></div></div></div>

    <div className="row between"><div><h2 className="section-title">Организаторы</h2><p className="muted">Любую сумму можно открыть и проверить. В кабинете самого организатора внутренние комиссии Atlas не раскрываются.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Организатор</th><th>Мероприятий</th><th>Оплачено клиентами</th><th>Заработок организатора</th><th>Возвраты</th><th>Сервисы</th><th>Остаток обязательства</th><th>Доход Atlas</th><th>Доступно к выплате</th></tr></thead><tbody>
      {summary.organizations.map(org=>{const outstanding=org.balanceMinor-(paidOutByOrg.get(org.organizationId)||0);return <tr key={org.organizationId}><td><Link href={`/platform/organizers/${org.organizationId}`}><strong>{org.organizationName}</strong></Link></td><td>{org.eventCount}</td><td><MoneyLink amount={org.buyerPaidMinor} metric="buyer" org={org.organizationId}/></td><td><MoneyLink amount={org.salesMinor} metric="organizerSales" org={org.organizationId}/></td><td><MoneyLink amount={org.refundsMinor} metric="refunds" org={org.organizationId}/></td><td><MoneyLink amount={org.servicesMinor} metric="services" org={org.organizationId}/></td><td><MoneyLink amount={outstanding} metric="liability" org={org.organizationId} strong/></td><td style={{fontWeight:700,color:"#15803d"}}><MoneyLink amount={org.atlasRevenueMinor} metric="atlasRevenue" org={org.organizationId}/></td><td><MoneyLink amount={org.availableMinor} metric="available" org={org.organizationId}/></td></tr>})}
      {!summary.organizations.length&&<tr><td colSpan={9}>Финансовых данных пока нет.</td></tr>}
    </tbody></table></div>

    <h2 className="section-title" style={{marginTop:28}}>Мероприятия и выплаты</h2>
    <div className="table-wrap"><table><thead><tr><th>Мероприятие</th><th>Организатор</th><th>Оплачено клиентами</th><th>Заработок организатора</th><th>Возвраты</th><th>Баланс после выплат</th><th>Atlas fee продажи</th><th>Atlas fee отмены</th><th>Платные SMS</th><th>Доступно</th><th>Плановая дата</th><th>Выплата</th></tr></thead><tbody>
      {summary.events.map(event=>{const atlasEventRevenue=event.atlasSalesFeeMinor+event.atlasCancellationFeeMinor+event.servicesMinor;return <tr key={event.eventId}><td><strong>{event.eventTitle}</strong><div className="muted" style={{fontSize:12}}>Доход Atlas: <MoneyLink amount={atlasEventRevenue} metric="atlasRevenue" org={event.organizationId} event={event.eventId}/></div></td><td>{event.organizationName}</td><td><MoneyLink amount={event.buyerPaidMinor} metric="buyer" org={event.organizationId} event={event.eventId}/></td><td><MoneyLink amount={event.salesMinor} metric="organizerSales" org={event.organizationId} event={event.eventId}/></td><td><MoneyLink amount={event.refundsMinor} metric="refunds" org={event.organizationId} event={event.eventId}/></td><td><MoneyLink amount={eventOutstanding(event)} metric="liability" org={event.organizationId} event={event.eventId} strong/></td><td><MoneyLink amount={event.atlasSalesFeeMinor} metric="salesFee" org={event.organizationId} event={event.eventId}/></td><td><MoneyLink amount={event.atlasCancellationFeeMinor} metric="cancellationFee" org={event.organizationId} event={event.eventId}/></td><td><MoneyLink amount={event.servicesMinor} metric="services" org={event.organizationId} event={event.eventId}/></td><td><MoneyLink amount={event.availableMinor} metric="available" org={event.organizationId} event={event.eventId} strong/></td><td>{new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:"numeric",timeZone:"Asia/Jerusalem"}).format(event.payoutDate)}</td><td>{event.availableMinor>0?<PlatformPayoutForm eventId={event.eventId} availableMinor={event.availableMinor}/>:<span className="muted">Недоступна</span>}</td></tr>})}
    </tbody></table></div>
    <div className="platform-card" style={{marginTop:20}}><strong>Правило SMS</strong><p className="muted" style={{marginBottom:8}}>Первая автоматическая SMS с билетом бесплатна для организатора. Автоматический retry этой же доставки тоже бесплатный. Платным сервисом считается только отдельная повторная отправка SMS. Неуспешная SMS не тарифицируется.</p><strong>Правило выплат</strong><p className="muted" style={{marginBottom:0}}>Кнопка «Зафиксировать» не выполняет банковский перевод. Она используется только после фактической выплаты организатору и записывает её в финансовую историю Atlas.</p></div>
  </PlatformShell>;
}
