import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { PromoterDetailManager } from "@/components/promoter-detail-manager";
import { PromoterOperationalManager } from "@/components/promoter-operational-manager";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";
import { refreshAbandonedCheckoutStatuses } from "@/lib/abandoned-maintenance";
import { getPromoterAutomation, getPromoterNotifications } from "@/lib/promoter-workflow";
import { getPublicOrigin } from "@/lib/public-origin";

export const dynamic="force-dynamic";
const PERIODS=[{value:"7d",label:"7 дней"},{value:"30d",label:"30 дней"},{value:"month",label:"Этот месяц"},{value:"all",label:"Всё время"}] as const;
type PeriodKey=(typeof PERIODS)[number]["value"];
type AbandonRow={metadataJson:string|null;token:string;abandonedAt:Date|null;status:string;orderId:string|null};
function start(period:PeriodKey){const now=new Date();if(period==="all")return undefined;if(period==="month")return new Date(now.getFullYear(),now.getMonth(),1);const d=new Date(now);d.setHours(0,0,0,0);d.setDate(d.getDate()-(period==="7d"?6:29));return d;}
function refCode(json:string|null){if(!json)return null;try{const x=JSON.parse(json) as {referralCode?:unknown};return typeof x.referralCode==="string"?x.referralCode.toUpperCase():null}catch{return null}}

export default async function PromoterDetailPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<Record<string,string|undefined>>}){
 const staff=await requirePermission("ANALYTICS_VIEW");const{id}=await params;const query=await searchParams;
 const promoter=await db.promoter.findUnique({where:{id}});
 if(!promoter||promoter.name.startsWith("__"))notFound();
 if(staff.role!=="ADMIN"&&(!staff.organizationId||promoter.organizationId!==staff.organizationId))notFound();
 const organizationId=promoter.organizationId;
 const publicOrigin=getPublicOrigin();
 const period=PERIODS.some(x=>x.value===query.period)?query.period as PeriodKey:"30d";const from=start(period);const allowed=staff.eventAccess.map(x=>x.eventId);
 const events=await db.event.findMany({where:{organizationId,...(staff.role!=="ADMIN"&&allowed.length?{id:{in:allowed}}:{})},orderBy:{startsAt:"desc"},include:{categories:true,zones:{include:{tables:true}}}});
 const eventId=query.event&&events.some(e=>e.id===query.event)?query.event:"all";const eventIds=eventId==="all"?events.map(e=>e.id):[eventId];
 const allPromoterLinks=await db.promoterLink.findMany({where:{promoterId:promoter.id,event:{organizationId}},orderBy:{createdAt:"desc"},include:{event:true,category:true,table:true}});
 const links=await db.promoterLink.findMany({where:{promoterId:promoter.id,eventId:{in:eventIds.length?eventIds:["__none__"]}},orderBy:{createdAt:"desc"},include:{event:true,category:true,table:true,visits:{where:from?{createdAt:{gte:from}}:undefined,select:{id:true}},orders:{where:{status:"PAID",...(from?{createdAt:{gte:from}}:{})},include:{items:true}}}});
 const [automation,notifications]=await Promise.all([getPromoterAutomation([promoter.id]),getPromoterNotifications(allPromoterLinks.map(link=>link.id))]);
 await ensureAbandonedCheckoutRuntime();
 await refreshAbandonedCheckoutStatuses();
 const abandons=eventIds.length?await db.$queryRawUnsafe<AbandonRow[]>(`SELECT "metadataJson","token","abandonedAt","status","orderId" FROM "AbandonedCheckout" WHERE "organizationId"=$1 AND "eventId"=ANY($2::text[])${from?' AND "createdAt">=$3':''}`,organizationId,eventIds,...(from?[from]:[])):[];
 const codeToAbandons=new Map<string,AbandonRow[]>();for(const row of abandons){const code=refCode(row.metadataJson);if(!code)continue;const list=codeToAbandons.get(code)||[];list.push(row);codeToAbandons.set(code,list);}
 const linkRows=links.map(link=>{const rows=codeToAbandons.get(link.code.toUpperCase())||[];const paidOrders=new Map(link.orders.map(order=>[order.id,order]));const orders=paidOrders.size;const tickets=[...paidOrders.values()].reduce((sum,order)=>sum+order.items.reduce((x,item)=>x+item.quantity,0),0);const revenue=[...paidOrders.values()].reduce((sum,order)=>sum+order.totalMinor,0);const clicks=link.visits.length;const checkout=new Set(rows.map(row=>row.token)).size;const abandoned=rows.filter(row=>row.abandonedAt).length;const recovered=rows.filter(row=>row.status==="RECOVERED").length;return{link,clicks,checkout,abandoned,recovered,orders,tickets,revenue,conversion:clicks?orders/clicks*100:0};});
 const clicks=linkRows.reduce((s,x)=>s+x.clicks,0),checkout=linkRows.reduce((s,x)=>s+x.checkout,0),abandoned=linkRows.reduce((s,x)=>s+x.abandoned,0),recovered=linkRows.reduce((s,x)=>s+x.recovered,0),orders=linkRows.reduce((s,x)=>s+x.orders,0),tickets=linkRows.reduce((s,x)=>s+x.tickets,0),revenue=linkRows.reduce((s,x)=>s+x.revenue,0),conversion=clicks?orders/clicks*100:0;const label=PERIODS.find(x=>x.value===period)?.label||"30 дней";
 return <AdminShell>
  <div className="office-page-heading"><div><Link href="/office/promoters">← Промоутеры</Link><span className="eyebrow">Promoter performance</span><h1>{promoter.name}</h1><p className="muted">{promoter.email||"Email не указан"}{promoter.phone?` · ${promoter.phone}`:""} · комиссия по умолчанию {(promoter.defaultCommissionBps/100).toFixed(2)}%</p></div><span className="pill" style={promoter.active?{background:"#dcfae6",color:"#067647"}:{}}>{promoter.active?"Активен":"Архивирован"}</span></div>
  {staff.permissionSet.has("EVENT_MANAGE")&&<PromoterOperationalManager promoterId={promoter.id} email={promoter.email} autoAssignAllEvents={automation.get(promoter.id)??false} events={events.map(e=>({id:e.id,title:e.title}))} assignments={allPromoterLinks.map(link=>{const note=notifications.get(link.id);return{id:link.id,eventId:link.eventId,eventTitle:link.event.title,eventStatus:link.event.status,shareUrl:`${publicOrigin}/events/${link.event.slug}?channel=${encodeURIComponent(link.code)}`,emailStatus:note?.status??"NOT_SENT",sentAt:note?.sentAt?.toISOString()??null,active:link.active}})}/>} 
  <form className="panel" method="get" style={{display:"flex",gap:14,alignItems:"end",flexWrap:"wrap",marginTop:24,marginBottom:24}}><div className="field" style={{margin:0,minWidth:180}}><label>Период</label><select name="period" defaultValue={period}>{PERIODS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div><div className="field" style={{margin:0,minWidth:260}}><label>Мероприятие</label><select name="event" defaultValue={eventId}><option value="all">Все мероприятия</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select></div><button className="btn dark">Применить</button></form>
  <div className="stats"><div className="stat"><span className="muted">Клики</span><strong>{clicks}</strong><small>{label}</small></div><div className="stat"><span className="muted">Checkout</span><strong>{checkout}</strong><small>{label}</small></div><div className="stat"><span className="muted">Abandoned</span><strong>{abandoned}</strong><small>{label}</small></div><div className="stat"><span className="muted">Recovered</span><strong>{recovered}</strong><small>{label}</small></div><div className="stat"><span className="muted">Заказы</span><strong>{orders}</strong><small>{tickets} билетов</small></div><div className="stat"><span className="muted">Выручка</span><strong>{money(revenue)}</strong><small>конверсия {conversion.toFixed(1)}%</small></div></div>
  <div className="panel" style={{marginTop:24}}><span className="eyebrow">Funnel</span><h2>Воронка продаж</h2><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginTop:16}}>{[["Клики",clicks],["Checkout",checkout],["Abandoned",abandoned],["Recovered",recovered],["Paid",orders]].map(([name,value],i)=><div key={String(name)} className="stat"><span className="muted">{name}</span><strong>{value}</strong>{i<4&&<small>→</small>}</div>)}</div></div>
  <div style={{marginTop:24}}><PromoterDetailManager promoter={{id:promoter.id,name:promoter.name,active:promoter.active,defaultCommissionBps:promoter.defaultCommissionBps}} events={events.map(e=>({id:e.id,title:e.title,slug:e.slug,categories:e.categories.map(c=>({id:c.id,name:c.name})),tables:e.zones.flatMap(z=>z.tables.map(t=>({id:t.id,label:`${z.name} · ${t.label}`})))}))} links={linkRows.map(({link,...stats})=>({id:link.id,label:link.label,active:link.active,eventId:link.eventId,eventTitle:link.event.title,shareUrl:`${publicOrigin}/events/${link.event.slug}?channel=${encodeURIComponent(link.code)}`,allocationType:link.allocationType,categoryId:link.categoryId,tableId:link.tableId,guestLimit:link.guestLimit,maxPerOrder:link.maxPerOrder,customPriceMinor:link.customPriceMinor,commissionBps:link.commissionBps,exclusive:link.exclusive,startsAt:link.startsAt?.toISOString()||null,endsAt:link.endsAt?.toISOString()||null,...stats}))}/></div>
 </AdminShell>;
}
