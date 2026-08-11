import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PromoterDetailManager } from "@/components/promoter-detail-manager";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

export const dynamic="force-dynamic";
const PUBLIC_ORIGIN="https://www.atlas-one.co";
const PERIODS=[{value:"7d",label:"7 дней"},{value:"30d",label:"30 дней"},{value:"month",label:"Этот месяц"},{value:"all",label:"Всё время"}] as const;
type PeriodKey=(typeof PERIODS)[number]["value"];

function start(period:PeriodKey){const now=new Date();if(period==="all")return undefined;if(period==="month")return new Date(now.getFullYear(),now.getMonth(),1);const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(period==="7d"?6:29));return d;}
function refCode(json:string|null){if(!json)return null;try{const x=JSON.parse(json) as {referralCode?:unknown};return typeof x.referralCode==="string"?x.referralCode.toUpperCase():null}catch{return null}}

type AbandonRow={metadataJson:string|null;token:string;abandonedAt:Date|null;status:string;orderId:string|null};

export default async function PromoterDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
  const staff=await requirePermission("ANALYTICS_VIEW");
  const {id}=await params;const query=await searchParams;
  const promoter=await db.promoter.findFirst({where:{id,organizationId:staff.organizationId!,NOT:{name:{startsWith:"__"}}}});if(!promoter)notFound();
  const period=PERIODS.some(x=>x.value===query.period)?query.period as PeriodKey:"30d";const from=start(period);
  const allowed=staff.eventAccess.map(x=>x.eventId);
  const events=await db.event.findMany({where:{organizationId:staff.organizationId!,...(allowed.length?{id:{in:allowed}}:{})},orderBy:{startsAt:"desc"},include:{categories:true,zones:{include:{tables:true}}}});
  const eventId=query.event&&events.some(e=>e.id===query.event)?query.event:"all";
  const eventIds=eventId==="all"?events.map(e=>e.id):[eventId];
  const links=await db.promoterLink.findMany({where:{promoterId:promoter.id,eventId:{in:eventIds.length?eventIds:["__none__"]}},orderBy:{createdAt:"desc"},include:{event:true,category:true,table:true,visits:{where:from?{createdAt:{gte:from}}:undefined,select:{id:true}},orders:{where:{status:"PAID",...(from?{createdAt:{gte:from}}:{})},include:{items:true}}}});
  await ensureAbandonedCheckoutRuntime();
  const abandons=eventIds.length?await db.$queryRawUnsafe<AbandonRow[]>(`SELECT "metadataJson","token","abandonedAt","status","orderId" FROM "AbandonedCheckout" WHERE "organizationId"=$1 AND "eventId"=ANY($2::text[])${from?' AND "createdAt">=$3':''}`,staff.organizationId!,eventIds,...(from?[from]:[])):[];
  const codes=new Set(links.map(l=>l.code.toUpperCase()));const promoterAbandons=abandons.filter(a=>{const c=refCode(a.metadataJson);return c&&codes.has(c)});
  const clicks=links.reduce((s,l)=>s+l.visits.length,0);const paid=links.flatMap(l=>l.orders);const uniqueOrders=new Map(paid.map(o=>[o.id,o]));const orders=uniqueOrders.size;const tickets=[...uniqueOrders.values()].reduce((s,o)=>s+o.items.reduce((x,i)=>x+i.quantity,0),0);const revenue=[...uniqueOrders.values()].reduce((s,o)=>s+o.totalMinor,0);const abandoned=promoterAbandons.filter(a=>a.abandonedAt).length;const recovered=promoterAbandons.filter(a=>a.status==="RECOVERED").length;const checkout=new Set(promoterAbandons.map(a=>a.token)).size;const conversion=clicks?orders/clicks*100:0;
  const label=PERIODS.find(x=>x.value===period)?.label||"30 дней";
  return <AdminShell>
    <div className="office-page-heading"><div><Link href="/office/promoters">← Промоутеры</Link><span className="eyebrow">Promoter performance</span><h1>{promoter.name}</h1><p className="muted">{promoter.email||promoter.phone||"Контакты не указаны"} · комиссия по умолчанию {(promoter.defaultCommissionBps/100).toFixed(2)}%</p></div><span className="pill" style={promoter.active?{background:"#dcfae6",color:"#067647"}:{}}>{promoter.active?"Активен":"Архивирован"}</span></div>
    <form className="panel" method="get" style={{display:"flex",gap:14,alignItems:"end",flexWrap:"wrap",marginBottom:24}}><div className="field" style={{margin:0,minWidth:180}}><label>Период</label><select name="period" defaultValue={period}>{PERIODS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div><div className="field" style={{margin:0,minWidth:260}}><label>Мероприятие</label><select name="event" defaultValue={eventId}><option value="all">Все мероприятия</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></div><button className="btn dark">Применить</button></form>
    <div className="stats"><div className="stat"><span className="muted">Клики</span><strong>{clicks}</strong><small>{label}</small></div><div className="stat"><span className="muted">Checkout</span><strong>{checkout}</strong><small>{label}</small></div><div className="stat"><span className="muted">Abandoned</span><strong>{abandoned}</strong><small>{label}</small></div><div className="stat"><span className="muted">Recovered</span><strong>{recovered}</strong><small>{label}</small></div><div className="stat"><span className="muted">Заказы</span><strong>{orders}</strong><small>{tickets} билетов</small></div><div className="stat"><span className="muted">Выручка</span><strong>{money(revenue)}</strong><small>конверсия {conversion.toFixed(1)}%</small></div></div>
    <div className="panel" style={{marginTop:24}}><span className="eyebrow">Funnel</span><h2>Воронка продаж</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:16}}>{[["Клики",clicks],["Checkout",checkout],["Abandoned",abandoned],["Recovered",recovered],["Paid",orders]].map(([name,value],i)=><div key={String(name)} className="stat"><span className="muted">{name}</span><strong>{value}</strong>{i<4&&<small>→</small>}</div>)}</div></div>
    <div style={{marginTop:24}}><PromoterDetailManager promoter={{id:promoter.id,name:promoter.name,active:promoter.active,defaultCommissionBps:promoter.defaultCommissionBps}} events={events.map(e=>({id:e.id,title:e.title,slug:e.slug,categories:e.categories.map(c=>({id:c.id,name:c.name})),tables:e.zones.flatMap(z=>z.tables.map(t=>({id:t.id,label:`${z.name} · ${t.label}`})))}))} links={links.map(l=>({id:l.id,label:l.label,active:l.active,eventTitle:l.event.title,shareUrl:`${PUBLIC_ORIGIN}/events/${l.event.slug}?channel=${encodeURIComponent(l.code)}`}))}/></div>
  </AdminShell>;
}
