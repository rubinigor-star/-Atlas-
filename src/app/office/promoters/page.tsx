import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { PromoterV2Create } from "@/components/promoter-v2-create";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { refreshAbandonedCheckoutStatuses } from "@/lib/abandoned-maintenance";
import { promoterV2Analytics } from "@/lib/promoter-v2-analytics";

export const dynamic="force-dynamic";
const PERIODS=[{value:"today",label:"Сегодня"},{value:"7d",label:"7 дней"},{value:"30d",label:"30 дней"},{value:"month",label:"Этот месяц"},{value:"all",label:"Всё время"}] as const;
type PeriodKey=(typeof PERIODS)[number]["value"];
function start(period:PeriodKey){const now=new Date();if(period==="all")return undefined;if(period==="month")return new Date(now.getFullYear(),now.getMonth(),1);const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(period==="today"?0:period==="7d"?6:29));return d;}

export default async function PromotersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const staff=await requirePermission("ANALYTICS_VIEW");if(!staff.organizationId)throw new Error("Organization required");const query=await searchParams;
 const period=PERIODS.some(x=>x.value===query.period)?query.period as PeriodKey:"30d";const from=start(period);await refreshAbandonedCheckoutStatuses();
 const allowed=staff.eventAccess.map(x=>x.eventId);const events=await db.event.findMany({where:{organizationId:staff.organizationId,...(staff.role!=="ADMIN"&&allowed.length?{id:{in:allowed}}:{})},select:{id:true,title:true,status:true},orderBy:{startsAt:"desc"}});
 const rows=await promoterV2Analytics(staff.organizationId,from);
 const totals=rows.reduce((s,r)=>({active:s.active+(r.active?1:0),clicks:s.clicks+r.clicks,checkouts:s.checkouts+r.checkouts,abandoned:s.abandoned+r.abandoned,recovered:s.recovered+r.recovered,orders:s.orders+r.orders,tickets:s.tickets+r.tickets,revenue:s.revenue+r.revenue}),{active:0,clicks:0,checkouts:0,abandoned:0,recovered:0,orders:0,tickets:0,revenue:0});const conversion=totals.clicks?totals.orders/totals.clicks*100:0;const periodLabel=PERIODS.find(x=>x.value===period)?.label||"30 дней";
 return <AdminShell>
  <div className="office-page-heading"><div><span className="eyebrow">Promoter V2</span><h1>Промоутеры</h1><p className="muted">Новый независимый модуль. Промоутеры сохраняются постоянно, а удаление заменено архивированием.</p></div></div>
  <form className="panel" method="get" style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap",marginBottom:24}}><div className="field" style={{margin:0,minWidth:190}}><label>Период аналитики</label><select name="period" defaultValue={period}>{PERIODS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div><button className="btn dark">Применить</button>{period!=="30d"&&<Link className="btn" href="/office/promoters">Сбросить</Link>}</form>
  <div className="stats"><div className="stat"><span className="muted">Активных</span><strong>{totals.active}</strong><small>постоянный список</small></div><div className="stat"><span className="muted">Клики</span><strong>{totals.clicks}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Checkout</span><strong>{totals.checkouts}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Abandoned</span><strong>{totals.abandoned}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Recovered</span><strong>{totals.recovered}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Заказы</span><strong>{totals.orders}</strong><small>{totals.tickets} билетов</small></div><div className="stat"><span className="muted">Выручка</span><strong>{money(totals.revenue)}</strong><small>{periodLabel}</small></div><div className="stat"><span className="muted">Конверсия</span><strong>{conversion.toFixed(1)}%</strong><small>orders / clicks</small></div></div>
  <div className="row between" style={{marginTop:30}}><div><h2 className="section-title" style={{marginBottom:4}}>Список промоутеров</h2><p className="muted" style={{margin:0}}>Фильтр периода меняет только KPI. Сам список людей не исчезает.</p></div></div>
  <div className="table-wrap"><table><thead><tr><th>Промоутер</th><th>Мероприятия</th><th>Клики</th><th>Checkout</th><th>Abandoned</th><th>Recovered</th><th>Заказы</th><th>Билеты</th><th>Выручка</th><th>Конверсия</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td><Link href={`/office/promoters/${r.id}`} style={{fontWeight:700}}>{r.name}</Link><br/><small>{r.active?"Активен":"Архивирован"}</small></td><td>{r.assignments}</td><td>{r.clicks}</td><td>{r.checkouts}</td><td>{r.abandoned}</td><td>{r.recovered}</td><td>{r.orders}</td><td>{r.tickets}</td><td>{money(r.revenue)}</td><td><strong>{(r.clicks?r.orders/r.clicks*100:0).toFixed(1)}%</strong></td></tr>)}{!rows.length&&<tr><td colSpan={10}>Промоутеров пока нет.</td></tr>}</tbody></table></div>
  {staff.permissionSet.has("EVENT_MANAGE")&&<details className="panel" style={{marginTop:28}}><summary style={{cursor:"pointer",fontWeight:700,fontSize:18}}>Добавить промоутера</summary><div style={{marginTop:18}}><PromoterV2Create events={events.map(e=>({id:e.id,title:e.title,status:e.status}))}/></div></details>}
 </AdminShell>;
}
