import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { ExcelExportButton } from "@/components/excel-export-button";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

function age(date:Date){const now=new Date();let value=now.getFullYear()-date.getFullYear();const before=now.getMonth()<date.getMonth()||(now.getMonth()===date.getMonth()&&now.getDate()<date.getDate());if(before)value--;return value;}
function pageHref(page:number){return page<=1?"/office/guests":`/office/guests?page=${page}`;}

type GuestsPageProps={searchParams:Promise<{page?:string}>};

export default async function GuestsPage({searchParams}:GuestsPageProps){
  const staff=await requirePermission("ORDER_VIEW");
  const query=await searchParams;
  const requestedPage=Math.max(1,Number.parseInt(query.page||"1",10)||1);
  const where={organizationId:staff.organizationId!};
  const total=await db.guestProfile.count({where});
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const page=Math.min(requestedPage,totalPages);

  const guests=await db.guestProfile.findMany({
    where,
    select:{id:true,firstName:true,lastName:true,phone:true,email:true,birthDate:true,city:true,instagram:true,facebook:true,status:true},
    orderBy:{updatedAt:"desc"},
    skip:(page-1)*PAGE_SIZE,
    take:PAGE_SIZE,
  });
  const guestIds=guests.map(guest=>guest.id);
  const orders=guestIds.length?await db.order.findMany({
    where:{guestId:{in:guestIds}},
    select:{guestId:true,status:true,totalMinor:true,createdAt:true,event:{select:{title:true}},tickets:{select:{_count:{select:{scans:true}}}}},
    orderBy:{createdAt:"desc"},
  }):[];
  const ordersByGuest=new Map<string,typeof orders>();
  for(const order of orders){if(!order.guestId)continue;const list=ordersByGuest.get(order.guestId)||[];list.push(order);ordersByGuest.set(order.guestId,list);}

  const rows=guests.map(guest=>{
    const allOrders=ordersByGuest.get(guest.id)||[];
    const activeOrders=allOrders.filter(order=>!["CANCELLED","REJECTED"].includes(order.status));
    const visits=activeOrders.reduce((sum,order)=>sum+order.tickets.filter(ticket=>ticket._count.scans>0).length,0);
    const revenue=activeOrders.reduce((sum,order)=>sum+order.totalMinor,0);
    const last=allOrders[0];
    return {"Имя":`${guest.firstName} ${guest.lastName}`,"Телефон":guest.phone,"Email":guest.email,"Возраст":age(guest.birthDate),"Город":guest.city,"Instagram":guest.instagram,"Facebook":guest.facebook,"Статус":guest.status,"Заказов":activeOrders.length,"Посещений":visits,"Оборот":money(revenue),"Последнее мероприятие":last?.event.title??"","Последняя активность":last?new Date(last.createdAt).toLocaleDateString("ru-IL"):""};
  });

  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Guest CRM</span><h1>Гости</h1><p>Единая база покупателей и приглашённых. На странице загружается не более {PAGE_SIZE} профилей.</p></div><ExcelExportButton rows={rows} filename={`atlas-guests-page-${page}`}/></div>
  <div className="table-wrap"><table><thead><tr><th>Гость</th><th>Профиль</th><th>Статус</th><th>Заказы</th><th>Посещения</th><th>Оборот</th><th>Последняя активность</th></tr></thead><tbody>{guests.map(guest=>{
    const allOrders=ordersByGuest.get(guest.id)||[];
    const activeOrders=allOrders.filter(order=>!["CANCELLED","REJECTED"].includes(order.status));
    const visits=activeOrders.reduce((sum,order)=>sum+order.tickets.filter(ticket=>ticket._count.scans>0).length,0);
    const revenue=activeOrders.reduce((sum,order)=>sum+order.totalMinor,0);
    const last=allOrders[0];
    return <tr key={guest.id}><td><strong>{guest.firstName} {guest.lastName}</strong><br/><a href={`https://wa.me/${guest.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer">WhatsApp</a> · <a href={`tel:${guest.phone}`}>{guest.phone}</a><br/><small>{guest.email}</small></td><td>{age(guest.birthDate)} лет · {guest.city}<br/><small>{guest.instagram} · {guest.facebook}</small></td><td><span className="pill">{guest.status}</span></td><td>{activeOrders.length}</td><td>{visits}</td><td>{money(revenue)}</td><td>{last?`${last.event.title} · ${new Date(last.createdAt).toLocaleDateString("ru-IL")}`:"—"}</td></tr>;
  })}{!guests.length&&<tr><td colSpan={7}>Профили появятся после новых регистраций.</td></tr>}</tbody></table></div>
  <div className="row between" style={{marginTop:18}}><span className="muted">Страница {page} из {totalPages} · всего {total}</span><div className="row" style={{gap:8}}>{page>1&&<Link prefetch={false} className="btn secondary" href={pageHref(page-1)}>Назад</Link>}{page<totalPages&&<Link prefetch={false} className="btn secondary" href={pageHref(page+1)}>Дальше</Link>}</div></div></AdminShell>;
}
