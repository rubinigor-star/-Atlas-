import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin-shell";
import { RequestInbox } from "@/components/request-inbox";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const staff=await requirePermission("REQUEST_REVIEW");
  const requests = await db.order.findMany({
    where: { status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "REJECTED"] },event:{organizationId:staff.organizationId!} },
    include: { event: true, items: true },
    orderBy: [{status:"asc"},{ createdAt: "desc" }],
  });
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Guest approval</span><h1>Заявки на билеты</h1><p>Проверяйте клиентов, резервируйте места и отправляйте ссылку на оплату.</p></div><span className="office-live"><i/>Обновляется автоматически</span></div><RequestInbox initialRequests={requests.map((request)=>({id:request.id,publicId:request.publicId,customerName:request.customerName,customerEmail:request.customerEmail,customerPhone:request.customerPhone,answer:request.eligibilityAnswer,status:request.status,eventTitle:request.event.title,eventDate:request.event.startsAt.toISOString(),createdAt:request.createdAt.toISOString(),totalMinor:request.totalMinor,items:request.items.map((item)=>({name:item.categoryName,quantity:item.quantity}))}))}/></AdminShell>;
}
