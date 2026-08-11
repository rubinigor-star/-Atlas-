import Link from "next/link";
import { requirePromoter } from "@/lib/promoter-auth";
import { db } from "@/lib/db";
import { money } from "@/lib/format";

export default async function PromoterDashboardPage(){
 const promoter=await requirePromoter();
 const links=await db.promoterLink.findMany({where:{promoterId:promoter.id,active:true},include:{event:true,visits:true,orders:{where:{status:'PAID'},include:{items:true}}},orderBy:{event:{startsAt:'asc'}}});
 const uniqueOrders=new Map(links.flatMap(l=>l.orders).map(o=>[o.id,o]));
 const clicks=links.reduce((s,l)=>s+l.visits.length,0);const orders=uniqueOrders.size;const tickets=[...uniqueOrders.values()].reduce((s,o)=>s+o.items.reduce((x,i)=>x+i.quantity,0),0);const revenue=[...uniqueOrders.values()].reduce((s,o)=>s+o.totalMinor,0);
 const upcoming=links.filter(l=>l.event.startsAt>=new Date()).slice(0,5);
 return <>
  <div style={{marginBottom:24}}><div style={{fontSize:13,textTransform:'uppercase',letterSpacing:'.12em',color:'#667085'}}>Promoter dashboard</div><h1 style={{fontSize:34,margin:'8px 0'}}>Здравствуйте, {promoter.name}</h1><p style={{color:'#667085'}}>Здесь отображаются только ваши мероприятия, ссылки и продажи.</p></div>
  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))',gap:14}}>{[['Активные мероприятия',links.length],['Клики',clicks],['Оплаченные заказы',orders],['Продано билетов',tickets],['Продажи',money(revenue)]].map(([label,value])=><div key={String(label)} style={{background:'white',borderRadius:16,padding:20,border:'1px solid #eaecf0'}}><div style={{color:'#667085',fontSize:13}}>{label}</div><div style={{fontSize:28,fontWeight:800,marginTop:8}}>{value}</div></div>)}</div>
  <div style={{marginTop:28,background:'white',borderRadius:16,padding:22,border:'1px solid #eaecf0'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center'}}><h2 style={{margin:0}}>Ближайшие мероприятия</h2><Link href='/promoter/events'>Все мероприятия</Link></div>{upcoming.length?upcoming.map(link=><div key={link.id} style={{padding:'16px 0',borderBottom:'1px solid #eaecf0',display:'flex',justifyContent:'space-between',gap:16,flexWrap:'wrap'}}><div><strong>{link.event.title}</strong><div style={{color:'#667085',marginTop:4}}>{link.event.startsAt.toLocaleString('ru-RU')}</div></div><div><strong>{link.orders.length}</strong> заказов</div></div>):<p style={{color:'#667085'}}>Нет ближайших назначенных мероприятий.</p>}</div>
  <div style={{marginTop:22,background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:16,padding:20}}><strong>Финансы</strong><p style={{marginBottom:0,color:'#7c2d12'}}>Финансовый settlement будет подключён отдельным модулем. Здесь пока намеренно не показываются предварительные суммы к выплате.</p></div>
 </>;
}
