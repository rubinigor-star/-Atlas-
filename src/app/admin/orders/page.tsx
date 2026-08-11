import Link from "next/link";
import { UserRound, UserRoundCheck } from "lucide-react";
import { db } from "@/lib/db";
import { money, eventDate, israelDateTime } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { ExcelExportButton } from "@/components/excel-export-button";
import { ageAt, getAllOrderDemographics } from "@/lib/customer-demographics";

export const dynamic="force-dynamic";
const PAGE_SIZE=25;
function genderLabel(value:string|null){return value==="MALE"?"Мужчина":value==="FEMALE"?"Женщина":"Не указан";}

export default async function Orders({searchParams}:{searchParams?:Promise<{page?:string}>}){
  const staff=await requirePermission("ORDER_VIEW");
  const query=searchParams?await searchParams:{};
  const requestedPage=Number.parseInt(query.page||"1",10);
  const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const where={event:{organizationId:staff.organizationId!},...(eventIds.length?{eventId:{in:eventIds}}:{})};
  const [total,orders,allDemographics]=await Promise.all([
    db.order.count({where}),
    db.order.findMany({where,select:{id:true,publicId:true,customerName:true,customerEmail:true,customerPhone:true,customerBirthDate:true,totalMinor:true,status:true,createdAt:true,event:{select:{title:true,startsAt:true}},_count:{select:{tickets:true}}},orderBy:{createdAt:"desc"},skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE}),
    getAllOrderDemographics(),
  ]);
  const orderIds=new Set((await db.order.findMany({where,select:{id:true}})).map(item=>item.id));
  const demographics=allDemographics.filter(item=>orderIds.has(item.orderId));
  const demographicsByOrder=new Map(demographics.map(item=>[item.orderId,item]));
  const male=demographics.filter(item=>item.gender==="MALE").length;const female=demographics.filter(item=>item.gender==="FEMALE").length;const knownGender=male+female;const ages=demographics.map(item=>ageAt(item.birthDate)).filter((age):age is number=>age!==null);const avgAge=ages.length?Math.round(ages.reduce((sum,age)=>sum+age,0)/ages.length):null;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));const currentPage=Math.min(page,totalPages);
  const rows=orders.map(order=>{const demo=demographicsByOrder.get(order.id);const age=ageAt(demo?.birthDate??order.customerBirthDate);return {"Номер заказа":order.publicId,"Мероприятие":order.event.title,"Дата мероприятия":eventDate(order.event.startsAt),"Клиент":order.customerName,"Пол":genderLabel(demo?.gender??null),"Возраст":age??"","Email":order.customerEmail,"Телефон":order.customerPhone,"Билетов":order._count.tickets,"Сумма":money(order.totalMinor),"Статус":order.status,"Дата заказа":israelDateTime(order.createdAt)};});
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>Заказы</h1><p>Оплаченные заказы, заявки и выпущенные билеты. Показано {orders.length} из {total}.</p></div><ExcelExportButton rows={rows} filename={`atlas-orders-page-${currentPage}`}/></div>
    <div className="stats"><div className="stat"><span className="muted">Мужчины</span><strong>{male}</strong><small>{knownGender?Math.round(male/knownGender*100):0}%</small></div><div className="stat"><span className="muted">Женщины</span><strong>{female}</strong><small>{knownGender?Math.round(female/knownGender*100):0}%</small></div><div className="stat"><span className="muted">Средний возраст</span><strong>{avgAge??"-"}</strong><small>{ages.length?`по ${ages.length} заказам`:"нет данных"}</small></div></div>
    <div className="table-wrap"><table><thead><tr><th>Номер</th><th>Событие</th><th>Клиент</th><th>Билетов</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map(order=>{const demo=demographicsByOrder.get(order.id);const age=ageAt(demo?.birthDate??order.customerBirthDate);const gender=demo?.gender??null;return <tr key={order.id}><td><Link prefetch={false} href={`/office/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td><strong>{order.event.title}</strong><br/><small>{eventDate(order.event.startsAt)}</small></td><td><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{gender==="MALE"?<UserRound size={16} color="#2563eb" strokeWidth={2.3}/>:gender==="FEMALE"?<UserRoundCheck size={16} color="#ef4444" strokeWidth={2.3}/>:null}<strong>{order.customerName}</strong></span><br/><small>{genderLabel(gender)}{age!==null?` · ${age} лет`:""} · {order.customerEmail}</small></td><td>{order._count.tickets}</td><td>{money(order.totalMinor)}</td><td><span className="pill">{order.status}</span></td></tr>})}{!orders.length&&<tr><td colSpan={6}>Заказов пока нет.</td></tr>}</tbody></table></div>
    {totalPages>1&&<nav className="row between" style={{marginTop:18}} aria-label="Страницы заказов"><div>{currentPage>1?<Link prefetch={false} className="btn secondary" href={`/office/orders?page=${currentPage-1}`}>Назад</Link>:<span/>}</div><span className="pill">Страница {currentPage} из {totalPages}</span><div>{currentPage<totalPages?<Link prefetch={false} className="btn secondary" href={`/office/orders?page=${currentPage+1}`}>Дальше</Link>:<span/>}</div></nav>}
  </AdminShell>;
}
