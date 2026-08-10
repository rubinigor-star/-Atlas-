import Link from "next/link";
import { UserRound, UserRoundCheck } from "lucide-react";
import { db } from "@/lib/db";
import { money, eventDate, israelDateTime } from "@/lib/format";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { ExcelExportButton } from "@/components/excel-export-button";

export const dynamic="force-dynamic";
const PAGE_SIZE=25;

function ageFromBirthDate(value:Date|null){if(!value)return null;const now=new Date();let age=now.getFullYear()-value.getFullYear();const beforeBirthday=now.getMonth()<value.getMonth()||(now.getMonth()===value.getMonth()&&now.getDate()<value.getDate());if(beforeBirthday)age--;return age>=0&&age<120?age:null;}
function genderLabel(value:string|null){return value==="MALE"?"Мужчина":value==="FEMALE"?"Женщина":"Не указан";}

export default async function Orders({searchParams}:{searchParams?:Promise<{page?:string}>}){
  const staff=await requirePermission("ORDER_VIEW");
  const query=searchParams?await searchParams:{};
  const requestedPage=Number.parseInt(query.page||"1",10);
  const page=Number.isFinite(requestedPage)&&requestedPage>0?requestedPage:1;
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const where={event:{organizationId:staff.organizationId!},...(eventIds.length?{eventId:{in:eventIds}}:{})};
  const [total,orders,demographics]=await Promise.all([
    db.order.count({where}),
    db.order.findMany({where,select:{id:true,publicId:true,customerName:true,customerEmail:true,customerPhone:true,customerGender:true,customerBirthDate:true,totalMinor:true,status:true,createdAt:true,event:{select:{title:true,startsAt:true}},_count:{select:{tickets:true}}},orderBy:{createdAt:"desc"},skip:(page-1)*PAGE_SIZE,take:PAGE_SIZE}),
    db.order.findMany({where,select:{customerGender:true,customerBirthDate:true}}),
  ]);
  const male=demographics.filter(item=>item.customerGender==="MALE").length;const female=demographics.filter(item=>item.customerGender==="FEMALE").length;const knownGender=male+female;const ages=demographics.map(item=>ageFromBirthDate(item.customerBirthDate)).filter((age):age is number=>age!==null);const avgAge=ages.length?Math.round(ages.reduce((sum,age)=>sum+age,0)/ages.length):null;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const currentPage=Math.min(page,totalPages);
  const rows=orders.map(order=>({"Номер заказа":order.publicId,"Мероприятие":order.event.title,"Дата мероприятия":eventDate(order.event.startsAt),"Клиент":order.customerName,"Пол":genderLabel(order.customerGender),"Возраст":ageFromBirthDate(order.customerBirthDate)??"","Email":order.customerEmail,"Телефон":order.customerPhone,"Билетов":order._count.tickets,"Сумма":money(order.totalMinor),"Статус":order.status,"Дата заказа":israelDateTime(order.createdAt)}));
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Orders</span><h1>Заказы</h1><p>Оплаченные заказы, заявки и выпущенные билеты. Показано {orders.length} из {total}.</p></div><ExcelExportButton rows={rows} filename={`atlas-orders-page-${currentPage}`}/></div>
    <div className="stats"><div className="stat"><span className="muted">Мужчины</span><strong>{male}</strong><small>{knownGender?Math.round(male/knownGender*100):0}%</small></div><div className="stat"><span className="muted">Женщины</span><strong>{female}</strong><small>{knownGender?Math.round(female/knownGender*100):0}%</small></div><div className="stat"><span className="muted">Средний возраст</span><strong>{avgAge??"—"}</strong><small>{ages.length?`по ${ages.length} заказам`:"нет данных"}</small></div></div>
    <div className="table-wrap"><table><thead><tr><th>Номер</th><th>Событие</th><th>Клиент</th><th>Билетов</th><th>Сумма</th><th>Статус</th></tr></thead><tbody>{orders.map(order=>{const age=ageFromBirthDate(order.customerBirthDate);return <tr key={order.id}><td><Link prefetch={false} href={`/office/orders/${order.publicId}`}><strong>{order.publicId}</strong></Link></td><td><strong>{order.event.title}</strong><br/><small>{eventDate(order.event.startsAt)}</small></td><td><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{order.customerGender==="MALE"?<UserRound size={16}/>:order.customerGender==="FEMALE"?<UserRoundCheck size={16}/>:null}<strong>{order.customerName}</strong></span><br/><small>{genderLabel(order.customerGender)}{age!==null?` · ${age} лет`:""} · {order.customerEmail}</small></td><td>{order._count.tickets}</td><td>{money(order.totalMinor)}</td><td><span className="pill">{order.status}</span></td></tr>})}{!orders.length&&<tr><td colSpan={6}>Заказов пока нет.</td></tr>}</tbody></table></div>
    {totalPages>1&&<nav className="row between" style={{marginTop:18}} aria-label="Страницы заказов"><div>{currentPage>1?<Link prefetch={false} className="btn secondary" href={`/office/orders?page=${currentPage-1}`}>Назад</Link>:<span/>}</div><span className="pill">Страница {currentPage} из {totalPages}</span><div>{currentPage<totalPages?<Link prefetch={false} className="btn secondary" href={`/office/orders?page=${currentPage+1}`}>Дальше</Link>:<span/>}</div></nav>}
  </AdminShell>;
}
