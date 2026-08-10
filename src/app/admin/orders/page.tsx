import Link from "next/link";
import { Mars, Venus } from "lucide-react";
import { db } from "@/lib/db";
import { money, eventDate, israelDateTime } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { ExcelExportButton } from "@/components/excel-export-button";
import { ageAt, getAllOrderDemographics } from "@/lib/customer-demographics";

export const dynamic="force-dynamic";
const PAGE_SIZE=25;

export default async function Orders({searchParams}:{searchParams?:Promise<{page?:string}>}){
  const staff=await requirePermission("ORDER_VIEW");
  const query=searchParams?await searchParams:{};
  const requestedPage=Number.parseInt(query.page||"1",10);
  const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const where={event:{organizationId:staff.organizationId!},...(eventIds.length?{eventId:{in:eventIds}}:{})};
  const [total,orders,allOrders,demographicRows]=await Promise.all([
    db.order.count({where}),
    db.order.findMany({
      where,
      select:{id:true,publicId:true,customerName:true,customerEmail:true,customerPhone:true,customerBirthDate:true,totalMinor:true,status:true,createdAt:true,event:{select:{title:true,startsAt:true}},_count:{select:{tickets:true}}},
      orderBy:{createdAt:"desc"},
      skip:(page-1)*PAGE_SIZE,
      take:PAGE_SIZE,
    }),
    db.order.findMany({where,select:{id:true,customerBirthDate:true}}),
    getAllOrderDemographics(),
  ]);
  const demographics=new Map(demographicRows.map(item=>[item.orderId,item]));
  const allowedIds=new Set(allOrders.map(item=>item.id));
  const scopedDemographics=demographicRows.filter(item=>allowedIds.has(item.orderId));
  const male=scopedDemographics.filter(item=>item.gender==="MALE").length;
  const female=scopedDemographics.filter(item=>item.gender==="FEMALE").length;
  const knownGender=male+female;
  const birthByOrder=new Map(allOrders.map(item=>[item.id,item.customerBirthDate]));
  const ages=scopedDemographics.map(item=>ageAt(item.birthDate??birthByOrder.get(item.orderId))).filter((value):value is number=>value!==null);
  const averageAge=ages.length?Math.round((ages.reduce((sum,value)=>sum+value,0)/ages.length)*10)/10:null;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const currentPage=Math.min(page,totalPages);
  const rows=orders.map(order=>{const demographic=demographics.get(order.id);const age=ageAt(demographic?.birthDate??order.customerBirthDate);return {"Номер заказа":order.publicId,"Мероприятие":order.event.title,"Дата мероприятия":eventDate(order.event.startsAt),"Клиент":order.customerName,"Пол":demographic?.gender==="MALE"?"Мужчина":demographic?.gender==="FEMALE"?"Женщина":"—","Возраст":age??"—","Email":order.customerEmail,"Телефон":order.customerPhone,"Билетов":order._count.tickets,"Сумма":money(order.totalMinor),"Статус":order.status,"Дата заказа":israelDateTime(order.createdAt)};});
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>Заказы</h1><p>Оплаченные заказы, заявки и выпущенные билеты. Показано {orders.length} из {total}.</p></div><ExcelExportButton rows={rows} filename={`atlas-orders-page-${currentPage}`}/></div>
    <div className="stats"><div className="stat"><span className="muted">Мужчины</span><strong>{male}</strong><small>{knownGender?Math.round(male/knownGender*100):0}% известных</small></div><div className="stat"><span className="muted">Женщины</span><strong>{female}</strong><small>{knownGender?Math.round(female/knownGender*100):0}% известных</small></div><div className="stat"><span className="muted">Средний возраст</span><strong>{averageAge??"—"}</strong><small>{ages.length} заказов с датой рождения</small></div></div>
    <div className="table-wrap"><table><thead><tr><th>Номер</th><th>Событие</th><th>Клиент</th><th>Возраст</th><th>Билетов</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map(order=>{const demographic=demographics.get(order.id);const age=ageAt(demographic?.birthDate??order.customerBirthDate);return <tr key={order.id}><td><Link prefetch={false} href={`/office/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td><strong>{order.event.title}</strong><br/><small>{eventDate(order.event.startsAt)}</small></td><td><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{demographic?.gender==="MALE"?<Mars size={17} aria-label="Мужчина"/>:demographic?.gender==="FEMALE"?<Venus size={17} aria-label="Женщина"/>:null}<strong>{order.customerName}</strong></span><br/><small>{order.customerEmail}</small></td><td>{age??"—"}</td><td>{order._count.tickets}</td><td>{money(order.totalMinor)}</td><td><span className="pill">{order.status}</span></td></tr>;})}{!orders.length&&<tr><td colSpan={7}>Заказов пока нет.</td></tr>}</tbody></table></div>
    {totalPages>1&&<nav className="row between" style={{marginTop:18}} aria-label="Страницы заказов"><div>{currentPage>1?<Link prefetch={false} className="btn secondary" href={`/office/orders?page=${currentPage-1}`}>Назад</Link>:<span/>}</div><span className="pill">Страница {currentPage} из {totalPages}</span><div>{currentPage<totalPages?<Link prefetch={false} className="btn secondary" href={`/office/orders?page=${currentPage+1}`}>Дальше</Link>:<span/>}</div></nav>}
  </AdminShell>;
}
