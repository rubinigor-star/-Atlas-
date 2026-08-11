import Link from "next/link";
import { requirePromoterV2 } from "@/lib/promoter-auth-v2";
import { promoterV2AssignmentAnalytics } from "@/lib/promoter-v2-analytics";
import { money } from "@/lib/format";

export default async function PromoterDashboardPage(){
 const promoter=await requirePromoterV2();
 const assignments=await promoterV2AssignmentAnalytics(promoter.id);
 const clicks=assignments.reduce((s,a)=>s+a.clicks,0),checkouts=assignments.reduce((s,a)=>s+a.checkouts,0),orders=assignments.reduce((s,a)=>s+a.orders,0),tickets=assignments.reduce((s,a)=>s+a.tickets,0),revenue=assignments.reduce((s,a)=>s+a.revenue,0);
 const upcoming=assignments.filter(a=>a.eventStatus==="PUBLISHED").slice(0,5);
 return <>
  <div style={{marginBottom:24}}><div style={{fontSize:13,textTransform:"uppercase",letterSpacing:".12em",color:"#667085"}}>Promoter dashboard</div><h1 style={{fontSize:34,margin:"8px 0"}}>Здравствуйте, {promoter.name}</h1><p style={{color:"#667085"}}>Здесь отображаются только ваши мероприятия, ссылки и продажи.</p></div>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14}}>{[["Мероприятия",assignments.length],["Клики",clicks],["Checkout",checkouts],["Оплаченные заказы",orders],["Билеты",tickets],["Продажи",money(revenue)]].map(([label,value])=><div key={String(label)} style={{background:"white",borderRadius:16,padding:20,border:"1px solid #eaecf0"}}><div style={{color:"#667085",fontSize:13}}>{label}</div><div style={{fontSize:28,fontWeight:800,marginTop:8}}>{value}</div></div>)}</div>
  <div style={{marginTop:28,background:"white",borderRadius:16,padding:22,border:"1px solid #eaecf0"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"center"}}><h2 style={{margin:0}}>Мои мероприятия</h2><Link href="/promoter/events">Все мероприятия</Link></div>{upcoming.length?upcoming.map(a=><div key={a.id} style={{padding:"16px 0",borderBottom:"1px solid #eaecf0",display:"flex",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}><div><strong>{a.eventTitle}</strong><div style={{color:"#667085",marginTop:4}}>{a.clicks} кликов · {a.checkouts} checkout</div></div><div><strong>{a.orders}</strong> заказов · {a.tickets} билетов</div></div>):<p style={{color:"#667085"}}>Нет назначенных опубликованных мероприятий.</p>}</div>
  <div style={{marginTop:22,background:"#fff7ed",border:"1px solid #fed7aa",borderRadius:16,padding:20}}><strong>Финансы</strong><p style={{marginBottom:0,color:"#7c2d12"}}>Расчёты к выплате будут подключены отдельным финансовым модулем. Здесь показывается только фактическая выручка по продажам.</p></div>
 </>;
}
