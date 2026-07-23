import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin-shell";
import { RequestInbox } from "@/components/request-inbox";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const staff=await requirePermission("REQUEST_REVIEW");
  const requests = await db.order.findMany({
    where: { status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "REJECTED"] },event:{organizationId:staff.organizationId!} },
    include: { event: true, items: true, guest:{include:{orders:{include:{tickets:{include:{scans:true}}}}}} },
    orderBy: [{status:"asc"},{ createdAt: "desc" }],
  });
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Guest approval</span><h1>Заявки на билеты</h1><p>Проверяйте клиента, его историю и связывайтесь с ним напрямую через WhatsApp.</p></div><span className="office-live"><i/>Обновляется автоматически</span></div><RequestInbox initialRequests={requests.map((request)=>{
    const previous=request.guest?.orders.filter(order=>order.id!==request.id)??[];
    const visits=previous.flatMap(order=>order.tickets).filter(ticket=>ticket.scans.length>0).length;
    return {id:request.id,publicId:request.publicId,customerName:request.customerName,customerEmail:request.customerEmail,customerPhone:request.customerPhone,birthDate:request.customerBirthDate?.toISOString()??request.guest?.birthDate.toISOString()??null,city:request.customerCity??request.guest?.city??null,facebook:request.customerFacebook??request.guest?.facebook??null,instagram:request.customerInstagram??request.guest?.instagram??null,guestStatus:request.guest?.status??null,previousOrders:previous.length,previousVisits:visits,answer:request.eligibilityAnswer,status:request.status,eventTitle:request.event.title,eventDate:request.event.startsAt.toISOString(),createdAt:request.createdAt.toISOString(),totalMinor:request.totalMinor,items:request.items.map((item)=>({name:item.categoryName,quantity:item.quantity}))};
  })}/></AdminShell>;
}
