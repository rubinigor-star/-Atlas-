import Link from "next/link";
import { UserRound, UserRoundCheck } from "lucide-react";
import { db } from "@/lib/db";
import { money, eventDate, israelDateTime } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { ExcelExportButton } from "@/components/excel-export-button";
import { ageAt, getAllOrderDemographics } from "@/lib/customer-demographics";
import { getImportedOrders } from "@/lib/imported-orders";

export const dynamic="force-dynamic";
const PAGE_SIZE=25;
function genderLabel(value:string|null){return value==="MALE"?"Мужчина":value==="FEMALE"?"Женщина":"Не указан";}

export default async function Orders({searchParams}:{searchParams?:Promise<{page?:string;view?:string}>}){
  const staff=await requirePermission("ORDER_VIEW");
  const query=searchParams?await searchParams:{};
  const requestedPage=Number.parseInt(query.page||"1",10);
  const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;
  const view=query.view==="imported"?"imported":"atlas";
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const scopedIds=staff.eventScope==="ALL"?undefined:eventIds;

  if(view==="imported"){
    const imported=await getImportedOrders({organizationId:staff.organizationId!,eventIds:scopedIds,page,pageSize:PAGE_SIZE});
    const totalPages=Math.max(1,Math.ceil(imported.total/PAGE_SIZE));const currentPage=Math.min(page,totalPages);
    const rows=imported.rows.map(order=>({"Номер внешнего заказа":order.externalOrderId||order.key,"Мероприятие":order.eventTitle,"Дата мероприятия":eventDate(new Date(order.startsAt)),"Клиент":order.customerName||"-","Телефон":order.customerPhone||"","Email":order.customerEmail||"","Уникальных клиентов":order.customerCount,"Билетов":order.ticketCount,"Вошли":order.usedCount,"Отменены":order.cancelledCount,"Сумма":money(order.totalMinor),"Тип":"Imported","Дата импорта":israelDateTime(new Date(order.createdAt))}));
    return <AdminShell>
      <div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>Заказы</h1><p>Импортированные продажи хранятся отдельно от продаж Atlas и не запускают оплату, approve, выдачу билетов или сообщения клиентам.</p></div><ExcelExportButton rows={rows} filename={`atlas-imported-orders-page-${currentPage}`}/></div>
      <div className="row" style={{marginBottom:18}}><Link className="btn secondary" href="/office/orders?view=atlas">Atlas</Link><Link className="btn" href="/office/orders?view=imported">Imported</Link></div>
      <div className="stats"><div className="stat"><span className="muted">Импортированных заказов</span><strong>{imported.total}</strong></div><div className="stat"><span className="muted">На этой странице</span><strong>{imported.rows.length}</strong></div><div className="stat"><span className="muted">Режим</span><strong>Read-only</strong><small>без автоматик Atlas</small></div></div>
      <div className="table-wrap"><table><thead><tr><th>Номер</th><th>Событие</th><th>Клиент</th><th>Билетов</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{imported.rows.map(order=><tr key={order.key}><td><strong>{order.externalOrderId||"Без номера"}</strong><br/><small className="muted">Imported</small></td><td><strong>{order.eventTitle}</strong><br/><small>{eventDate(new Date(order.startsAt))}</small></td><td><strong>{order.customerName||"Клиент из импорта"}</strong><br/><small>{order.customerCount>1?`${order.customerCount} клиента · `:""}{order.customerPhone||"без телефона"}{order.customerEmail?` · ${order.customerEmail}`:""}</small></td><td>{order.ticketCount}<br/><small>{order.usedCount} вошли{order.cancelledCount?` · ${order.cancelledCount} отменены`:""}</small></td><td>{money(order.totalMinor)}</td><td><span className="pill">IMPORTED</span></td></tr>)}{!imported.rows.length&&<tr><td colSpan={6}>Импортированных заказов пока нет.</td></tr>}</tbody></table></div>
      {totalPages>1&&<nav className="row between" style={{marginTop:18}} aria-label="Страницы импортированных заказов"><div>{currentPage>1?<Link className="btn secondary" href={`/office/orders?view=imported&page=${currentPage-1}`}>Назад</Link>:<span/>}</div><span className="pill">Страница {currentPage} из {totalPages}</span><div>{currentPage<totalPages?<Link className="btn secondary" href={`/office/orders?view=imported&page=${currentPage+1}`}>Дальше</Link>:<span/>}</div></nav>}
    </AdminShell>;
  }

  const where={event:{organizationId:staff.organizationId!},...(scopedIds?{eventId:{in:scopedIds}}:{})};
  const [total,orders,allDemographics,importedCount]=await Promise.all([
    db.order.count({where}),
    db.order.findMany({where,select:{id:true,publicId:true,customerName:true,customerEmail:true,customerPhone:true,customerBirthDate:true,totalMinor:true,status:true,createdAt:true,event:{select:{title:true,startsAt:true}},_count:{select:{tickets:true}}},orderBy:{createdAt:"desc"},skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE}),
    getAllOrderDemographics(),
    getImportedOrders({organizationId:staff.organizationId!,eventIds:scopedIds,page:1,pageSize:1}).then(result=>result.total),
  ]);
  const orderIds=new Set((await db.order.findMany({where,select:{id:true}})).map(item=>item.id));
  const demographics=allDemographics.filter(item=>orderIds.has(item.orderId));const demographicsByOrder=new Map(demographics.map(item=>[item.orderId,item]));
  const male=demographics.filter(item=>item.gender==="MALE").length;const female=demographics.filter(item=>item.gender==="FEMALE").length;const knownGender=male+female;const ages=demographics.map(item=>ageAt(item.birthDate)).filter((age):age is number=>age!==null);const avgAge=ages.length?Math.round(ages.reduce((sum,age)=>sum+age,0)/ages.length):null;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));const currentPage=Math.min(page,totalPages);
  const rows=orders.map(order=>{const demo=demographicsByOrder.get(order.id);const age=ageAt(demo?.birthDate??order.customerBirthDate);return {"Номер заказа":order.publicId,"Мероприятие":order.event.title,"Дата мероприятия":eventDate(order.event.startsAt),"Клиент":order.customerName,"Пол":genderLabel(demo?.gender??null),"Возраст":age??"","Email":order.customerEmail,"Телефон":order.customerPhone,"Билетов":order._count.tickets,"Сумма":money(order.totalMinor),"Статус":order.status,"Дата заказа":israelDateTime(order.createdAt)};});
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>Заказы</h1><p>Оплаченные заказы, заявки и выпущенные билеты Atlas. Показано {orders.length} из {total}.</p></div><ExcelExportButton rows={rows} filename={`atlas-orders-page-${currentPage}`}/></div>
    <div className="row" style={{marginBottom:18}}><Link className="btn" href="/office/orders?view=atlas">Atlas</Link><Link className="btn secondary" href="/office/orders?view=imported">Imported {importedCount?`(${importedCount})`:""}</Link></div>
    <div className="stats"><div className="stat"><span className="muted">Мужчины</span><strong>{male}</strong><small>{knownGender?Math.round(male/knownGender*100):0}%</small></div><div className="stat"><span className="muted">Женщины</span><strong>{female}</strong><small>{knownGender?Math.round(female/knownGender*100):0}%</small></div><div className="stat"><span className="muted">Средний возраст</span><strong>{avgAge??"-"}</strong><small>{ages.length?`по ${ages.length} заказам`:"нет данных"}</small></div></div>
    <div className="table-wrap"><table><thead><tr><th>Номер</th><th>Событие</th><th>Клиент</th><th>Билетов</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map(order=>{const demo=demographicsByOrder.get(order.id);const age=ageAt(demo?.birthDate??order.customerBirthDate);const gender=demo?.gender??null;return <tr key={order.id}><td><Link prefetch={false} href={`/office/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td><strong>{order.event.title}</strong><br/><small>{eventDate(order.event.startsAt)}</small></td><td><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{gender==="MALE"?<UserRound size={16}/>:gender==="FEMALE"?<UserRoundCheck size={16}/>:null}<strong>{order.customerName}</strong></span><br/><small>{genderLabel(gender)}{age!==null?` · ${age} лет`:""} · {order.customerEmail}</small></td><td>{order._count.tickets}</td><td>{money(order.totalMinor)}</td><td><span className="pill">{order.status}</span></td></tr>})}{!orders.length&&<tr><td colSpan={6}>Заказов пока нет.</td></tr>}</tbody></table></div>
    {totalPages>1&&<nav className="row between" style={{marginTop:18}} aria-label="Страницы заказов"><div>{currentPage>1?<Link prefetch={false} className="btn secondary" href={`/office/orders?view=atlas&page=${currentPage-1}`}>Назад</Link>:<span/>}</div><span className="pill">Страница {currentPage} из {totalPages}</span><div>{currentPage<totalPages?<Link prefetch={false} className="btn secondary" href={`/office/orders?view=atlas&page=${currentPage+1}`}>Дальше</Link>:<span/>}</div></nav>}
  </AdminShell>;
}
