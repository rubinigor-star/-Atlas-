import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { PromoterManager } from "@/components/promoter-manager";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";

const TECHNICAL_PROMOTER_PREFIX = "__";
const PERIODS = [
  { value: "today", label: "Сегодня" },
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "month", label: "Этот месяц" },
  { value: "all", label: "Всё время" },
  { value: "custom", label: "Свой период" },
] as const;

type PeriodKey = (typeof PERIODS)[number]["value"];
type AbandonRow = { token:string; orderId:string|null; metadataJson:string|null; abandonedAt:Date|null; status:string };

function startOfDay(date:Date){const value=new Date(date);value.setHours(0,0,0,0);return value;}
function parseDate(value:string|undefined,end=false){if(!value)return undefined;const date=new Date(`${value}T${end?"23:59:59.999":"00:00:00.000"}`);return Number.isNaN(date.getTime())?undefined:date;}
function resolvePeriod(period:PeriodKey,from?:string,to?:string){const now=new Date();if(period==="all")return{from:undefined,to:undefined};if(period==="custom")return{from:parseDate(from),to:parseDate(to,true)};if(period==="today")return{from:startOfDay(now),to:now};if(period==="month")return{from:new Date(now.getFullYear(),now.getMonth(),1),to:now};const days=period==="7d"?7:30;const start=startOfDay(now);start.setDate(start.getDate()-(days-1));return{from:start,to:now};}
function rangeWhere(from?:Date,to?:Date){if(!from&&!to)return undefined;return{...(from?{gte:from}:{}),...(to?{lte:to}:{})};}
function referralCode(metadataJson:string|null){if(!metadataJson)return null;try{const parsed=JSON.parse(metadataJson) as {referralCode?:unknown};return typeof parsed.referralCode==="string"?parsed.referralCode.toUpperCase():null}catch{return null}}

export default async function PromotersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const staff=await requirePermission("ANALYTICS_VIEW");const organizationId=staff.organizationId!;const query=await searchParams;
  const period=PERIODS.some(item=>item.value===query.period)?query.period as PeriodKey:"30d";const range=resolvePeriod(period,query.from,query.to);const createdAt=rangeWhere(range.from,range.to);
  const allowedEventIds=staff.eventAccess.map(item=>item.eventId);const eventScope=allowedEventIds.length?{id:{in:allowedEventIds}}:{};
  const events=await db.event.findMany({where:{organizationId,...eventScope},orderBy:{startsAt:"desc"},include:{categories:true,zones:{include:{tables:true}}}});
  const selectedEventId=query.event&&events.some(event=>event.id===query.event)?query.event:"all";const selectedEventIds=selectedEventId==="all"?events.map(event=>event.id):[selectedEventId];
  const [promoters,links]=await Promise.all([
    db.promoter.findMany({where:{organizationId,NOT:{name:{startsWith:TECHNICAL_PROMOTER_PREFIX}}},orderBy:[{active:"desc"},{name:"asc"}]}),
    db.promoterLink.findMany({where:{eventId:{in:selectedEventIds.length?selectedEventIds:["__none__"]},promoter:{NOT:{name:{startsWith:TECHNICAL_PROMOTER_PREFIX}}}},include:{promoter:true,event:true,visits:{where:createdAt?{createdAt}:undefined,select:{id:true}},orders:{where:{status:"PAID",...(createdAt?{createdAt}:{})},include:{items:true}}}}),
  ]);
  await ensureAbandonedCheckoutRuntime();const abandonParams:unknown[]=[organizationId,selectedEventIds];let abandonRange="";if(range.from){abandonParams.push(range.from);abandonRange+=` AND c.\"createdAt\">=$${abandonParams.length}`;}if(range.to){abandonParams.push(range.to);abandonRange+=` AND c.\"createdAt\"<=$${abandonParams.length}`;}
  const abandons=selectedEventIds.length?await db.$queryRawUnsafe<AbandonRow[]>(`SELECT c.\"token\",c.\"orderId\",c.\"metadataJson\",c.\"abandonedAt\",c.\"status\" FROM \"AbandonedCheckout\" c WHERE c.\"organizationId\"=$1 AND c.\"eventId\"=ANY($2::text[])${abandonRange}`,...abandonParams):[];
  const promoterByCode=new Map(links.map(link=>[link.code.toUpperCase(),link.promoterId]));const abandonByPromoter=new Map<string,{tokens:Set<string>;recovered:number;abandoned:number;recoveredOrderIds:Set<string>}>();
  for(const row of abandons){const code=referralCode(row.metadataJson);const promoterId=code?promoterByCode.get(code):undefined;if(!promoterId)continue;const stats=abandonByPromoter.get(promoterId)??{tokens:new Set<string>(),recovered:0,abandoned:0,recoveredOrderIds:new Set<string>()};stats.tokens.add(row.token);if(row.abandonedAt)stats.abandoned++;if(row.status==="RECOVERED"){stats.recovered++;if(row.orderId)stats.recoveredOrderIds.add(row.orderId);}abandonByPromoter.set(promoterId,stats);}
  const rows=promoters.map(promoter=>{const promoterLinks=links.filter(link=>link.promoterId===promoter.id);const clicks=promoterLinks.reduce((s,l)=>s+l.visits.length,0);const paidOrders=promoterLinks.flatMap(link=>link.orders);const uniqueOrders=new Map(paidOrders.map(order=>[order.id,order]));const orderIds=new Set(uniqueOrders.keys());const orders=orderIds.size;const tickets=[...uniqueOrders.values()].reduce((s,o)=>s+o.items.reduce((x,i)=>x+i.quantity,0),0);const revenue=[...uniqueOrders.values()].reduce((s,o)=>s+o.totalMinor,0);const abandon=abandonByPromoter.get(promoter.id);const recoveredOrderIds=abandon?.recoveredOrderIds??new Set<string>();const normalPaidOrders=[...orderIds].filter(id=>!recoveredOrderIds.has(id)).length;return{id:promoter.id,name:promoter.name,active:promoter.active,links:promoterLinks.length,clicks,checkoutStarts:(abandon?.tokens.size??0)+normalPaidOrders,abandoned:abandon?.abandoned??0,recovered:abandon?.recovered??0,orders,tickets,revenue,conversion:clicks?orders/clicks*100:0};}).filter(row=>row.links>0||selectedEventId==="all");
  const totals=rows.reduce((s,r)=>({promoters:s.promoters+(r.active&&r.links?1:0),clicks:s.clicks+r.clicks,orders:s.orders+r.orders,tickets:s.tickets+r.tickets,revenue:s.revenue+r.revenue}),{promoters:0,clicks:0,orders:0,tickets:0,revenue:0});const totalConversion=totals.clicks?totals.orders/totals.clicks*100:0;const periodLabel=PERIODS.find(item=>item.value===period)?.label??"30 дней";
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Promoter sales</span><h1>Промоутеры</h1><p className="muted">Сравнивайте реальную эффективность промоутеров: от уникального перехода по ссылке до оплаченного заказа.</p></div></div>
    <form className="panel" method="get" style={{display:"flex",gap:14,alignItems:"end",flexWrap:"wrap",marginBottom:24}}><div className="field" style={{minWidth:180,margin:0}}><label>Период</label><select name="period" defaultValue={period}>{PERIODS.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}</select></div><div className="field" style={{minWidth:260,margin:0}}><label>Мероприятие</label><select name="event" defaultValue={selectedEventId}><option value="all">Все мероприятия</option>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></div><div className="field" style={{margin:0}}><label>С</label><input className="input" type="date" name="from" defaultValue={query.from??""}/></div><div className="field" style={{margin:0}}><label>По</label><input className="input" type="date" name="to" defaultValue={query.to??""}/></div><button className="btn dark">Применить</button>{(period!=="30d"||selectedEventId!=="all"||query.from||query.to)&&<Link className="btn" href="/office/promoters">Сбросить</Link>}</form>
    <div className="stats"><div className="stat"><span className="muted">Активных промоутеров</span><strong>{totals.promoters}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Уникальные клики</span><strong>{totals.clicks}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Оплаченные заказы</span><strong>{totals.orders}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Продано билетов</span><strong>{totals.tickets}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Выручка</span><strong>{money(totals.revenue)}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Конверсия</span><strong>{totalConversion.toFixed(1)}%</strong><small>заказы / клики</small></div></div>
    <div className="row between" style={{marginTop:30}}><div><h2 className="section-title" style={{marginBottom:4}}>Промоутеры</h2><p className="muted" style={{margin:0}}>Нажмите на имя, чтобы открыть ссылки, воронку и управление конкретным промоутером.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Промоутер</th><th>Ссылки</th><th>Клики</th><th>Checkout</th><th>Abandoned</th><th>Recovered</th><th>Заказы</th><th>Билеты</th><th>Выручка</th><th>Конверсия</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><Link href={`/office/promoters/${row.id}`} style={{fontWeight:700}}>{row.name}</Link><br/><small>{row.active?"Активен":"Архивирован"}</small></td><td>{row.links}</td><td>{row.clicks}</td><td>{row.checkoutStarts}</td><td>{row.abandoned}</td><td>{row.recovered}</td><td>{row.orders}</td><td>{row.tickets}</td><td>{money(row.revenue)}</td><td><strong>{row.conversion.toFixed(1)}%</strong></td></tr>)}{!rows.length&&<tr><td colSpan={10}>За выбранный период данных по промоутерам пока нет.</td></tr>}</tbody></table></div>
    {staff.permissionSet.has("EVENT_MANAGE")&&<details className="panel" style={{marginTop:28}}><summary style={{cursor:"pointer",fontWeight:700,fontSize:18}}>Добавить промоутера</summary><p className="muted">Создайте промоутера здесь. После создания откройте его карточку и создавайте ссылки уже внутри него.</p><PromoterManager promoters={promoters.filter(item=>item.active).map(item=>({id:item.id,name:item.name,defaultCommissionBps:item.defaultCommissionBps}))} events={events.map(event=>({id:event.id,title:event.title,categories:event.categories.map(item=>({id:item.id,name:item.name})),tables:event.zones.flatMap(zone=>zone.tables.map(item=>({id:item.id,label:`${zone.name} · ${item.label}`})))}))}/></details>}
  </AdminShell>;
}
