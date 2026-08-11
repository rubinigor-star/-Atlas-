import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PromoterV2Detail } from "@/components/promoter-v2-detail";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { refreshAbandonedCheckoutStatuses } from "@/lib/abandoned-maintenance";
import { getPromoterV2 } from "@/lib/promoter-v2";
import { promoterV2AssignmentAnalytics } from "@/lib/promoter-v2-analytics";
import { promoterAccountV2State } from "@/lib/promoter-auth-v2";

export const dynamic="force-dynamic";
const PERIODS=[{value:"7d",label:"7 дней"},{value:"30d",label:"30 дней"},{value:"month",label:"Этот месяц"},{value:"all",label:"Всё время"}] as const;
type PeriodKey=(typeof PERIODS)[number]["value"];
function start(period:PeriodKey){const now=new Date();if(period==="all")return undefined;if(period==="month")return new Date(now.getFullYear(),now.getMonth(),1);const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(period==="7d"?6:29));return d;}

export default async function PromoterDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const staff=await requirePermission("ANALYTICS_VIEW");const{id}=await params;const query=await searchParams;const promoter=await getPromoterV2(id);if(!promoter)notFound();if(staff.role!=="ADMIN"&&staff.organizationId!==promoter.organizationId)notFound();
 const period=PERIODS.some(x=>x.value===query.period)?query.period as PeriodKey:"30d";const from=start(period);await refreshAbandonedCheckoutStatuses();const allowed=staff.eventAccess.map(x=>x.eventId);
 const events=await db.event.findMany({where:{organizationId:promoter.organizationId,...(staff.role!=="ADMIN"&&allowed.length?{id:{in:allowed}}:{})},select:{id:true,title:true,status:true},orderBy:{startsAt:"desc"}});
 const [assignments,accountState]=await Promise.all([promoterV2AssignmentAnalytics(promoter.id,from),promoterAccountV2State(promoter.id)]);const clicks=assignments.reduce((s,x)=>s+x.clicks,0),checkouts=assignments.reduce((s,x)=>s+x.checkouts,0),abandoned=assignments.reduce((s,x)=>s+x.abandoned,0),recovered=assignments.reduce((s,x)=>s+x.recovered,0),orders=assignments.reduce((s,x)=>s+x.orders,0),tickets=assignments.reduce((s,x)=>s+x.tickets,0),revenue=assignments.reduce((s,x)=>s+x.revenue,0),conversion=clicks?orders/clicks*100:0;const label=PERIODS.find(x=>x.value===period)?.label||"30 дней";
 return <AdminShell>
  <div className="office-page-heading"><div><Link href="/office/promoters">← Промоутеры</Link><span className="eyebrow">Promoter V2</span><h1>{promoter.name}</h1><p className="muted">{promoter.email}{promoter.phone?` · ${promoter.phone}`:""}</p></div><span className="pill">{promoter.active?"Активен":"Архивирован"}</span></div>
  <form className="panel" method="get" style={{display:"flex",gap:12,alignItems:"end",flexWrap:"wrap",marginBottom:24}}><div className="field" style={{margin:0,minWidth:180}}><label>Период</label><select name="period" defaultValue={period}>{PERIODS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div><button className="btn dark">Применить</button></form>
  <div className="stats"><div className="stat"><span className="muted">Клики</span><strong>{clicks}</strong><small>{label}</small></div><div className="stat"><span className="muted">Checkout</span><strong>{checkouts}</strong><small>{label}</small></div><div className="stat"><span className="muted">Abandoned</span><strong>{abandoned}</strong><small>{label}</small></div><div className="stat"><span className="muted">Recovered</span><strong>{recovered}</strong><small>{label}</small></div><div className="stat"><span className="muted">Заказы</span><strong>{orders}</strong><small>{tickets} билетов</small></div><div className="stat"><span className="muted">Выручка</span><strong>{money(revenue)}</strong><small>конверсия {conversion.toFixed(1)}%</small></div></div>
  {staff.permissionSet.has("EVENT_MANAGE")?<div style={{marginTop:24}}><PromoterV2Detail promoter={{id:promoter.id,name:promoter.name,email:promoter.email,phone:promoter.phone,active:promoter.active,autoAssignAllEvents:promoter.autoAssignAllEvents,defaultCommissionBps:promoter.defaultCommissionBps}} events={events.map(e=>({id:e.id,title:e.title,status:e.status}))} assignments={assignments} accountState={accountState}/></div>:<div className="panel" style={{marginTop:24}}><p className="muted">У вас есть доступ к аналитике, но нет прав на управление промоутером.</p></div>}
 </AdminShell>;
}
