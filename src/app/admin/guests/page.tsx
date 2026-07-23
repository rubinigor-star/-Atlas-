import { AdminShell } from "@/components/admin-shell";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { money } from "@/lib/format";

export const dynamic="force-dynamic";

function age(date:Date){const now=new Date();let value=now.getFullYear()-date.getFullYear();const before=now.getMonth()<date.getMonth()||(now.getMonth()===date.getMonth()&&now.getDate()<date.getDate());if(before)value--;return value;}

export default async function GuestsPage(){
  const staff=await requirePermission("ORDER_VIEW");
  const guests=await db.guestProfile.findMany({where:{organizationId:staff.organizationId!},include:{orders:{include:{tickets:{include:{scans:true}},event:true,promoterLink:true}}},orderBy:{updatedAt:"desc"}});
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Guest CRM</span><h1>Гости</h1><p>Единая история покупок, посещений, источников и статусов клиента.</p></div></div>
  <div className="table-wrap"><table><thead><tr><th>Гость</th><th>Профиль</th><th>Статус</th><th>Заказы</th><th>Посещения</th><th>Оборот</th><th>Последняя активность</th></tr></thead><tbody>{guests.map(guest=>{
    const orders=guest.orders.filter(order=>!['CANCELLED','REJECTED'].includes(order.status));
    const visits=orders.flatMap(order=>order.tickets).filter(ticket=>ticket.scans.length>0).length;
    const revenue=orders.reduce((sum,order)=>sum+order.totalMinor,0);
    const last=guest.orders[0];
    return <tr key={guest.id}><td><strong>{guest.firstName} {guest.lastName}</strong><br/><a href={`https://wa.me/${guest.phone.replace(/\D/g,"")}`} target="_blank">WhatsApp</a> · <a href={`tel:${guest.phone}`}>{guest.phone}</a><br/><small>{guest.email}</small></td><td>{age(guest.birthDate)} лет · {guest.city}<br/><small>{guest.instagram} · {guest.facebook}</small></td><td><span className="pill">{guest.status}</span></td><td>{orders.length}</td><td>{visits}</td><td>{money(revenue)}</td><td>{last?`${last.event.title} · ${new Date(last.createdAt).toLocaleDateString("ru-RU")}`:"—"}</td></tr>;
  })}{!guests.length&&<tr><td colSpan={7}>Профили появятся после новых регистраций.</td></tr>}</tbody></table></div></AdminShell>;
}
