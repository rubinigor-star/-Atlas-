import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin-shell";
import { RequestInbox } from "@/components/request-inbox";
import { canAccessEvent, requirePermission } from "@/lib/auth";
import { getActiveOrderReviewJobIds } from "@/lib/order-review-queue";
import { getOrderDemographicsForOrders } from "@/lib/customer-demographics";
import { searchValueCardMembers } from "@/lib/valuecard";

export const dynamic = "force-dynamic";
const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";

export default async function RequestsPage() {
  const staff = await requirePermission("REQUEST_REVIEW");
  const approvalOrderRows = await db.$queryRawUnsafe<Array<{ id: string; eventId: string }>>(
    `SELECT o."id", o."eventId"
     FROM "Order" o
     JOIN "Event" e ON e."id"=o."eventId"
     WHERE o."salesFlow"='APPROVAL'
       AND e."organizationId"=$1
       AND (
         o."status" <> 'PENDING_APPROVAL'
         OR EXISTS (
           SELECT 1 FROM "PaymentAuthorization" pa
           WHERE pa."orderId"=o."id" AND pa."status"='AUTHORIZED'
             AND pa."provider" IN ('HYP','ATLAS_TEST') AND pa."amountMinor"=o."totalMinor"
         )
         OR (
           o."totalMinor"=0
           AND EXISTS (
             SELECT 1 FROM "PromoterLink" pl
             JOIN "Promoter" p ON p."id"=pl."promoterId"
             WHERE pl."id"=o."promoterLinkId"
               AND (p."name" LIKE '__GUEST_LIST__:%' OR p."name" LIKE '__CHANNEL__:GUEST:%')
           )
         )
       )`,
    staff.organizationId!,
  );
  const approvalOrderIds = approvalOrderRows.filter(row=>canAccessEvent(staff,row.eventId)).map(row=>row.id);

  const requests = approvalOrderIds.length
    ? await db.order.findMany({
        where: { id: { in: approvalOrderIds }, status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAID", "REJECTED", "CANCELLED"] }, OR: [{ reviewNote: null }, { reviewNote: { not: DISMISSED_EXPIRED_NOTE } }] },
        include: { event: true, items: true, guest: { include: { orders: { include: { tickets: { include: { scans: true } } } } } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      })
    : [];

  const [recoveryRows, activeReviewIds] = await Promise.all([
    db.$queryRaw<Array<{ orderId: string }>>`
      SELECT pa."orderId" FROM "PaymentAuthorization" pa
      JOIN "Order" o ON o."id"=pa."orderId"
      WHERE o."salesFlow"='APPROVAL' AND pa.provider = 'HYP' AND pa.status = 'CAPTURED' AND pa."hypCaptureTransId" IS NULL
    `,
    getActiveOrderReviewJobIds(requests.map((request) => request.id)),
  ]);
  const recoveryIds = new Set(recoveryRows.map((row) => row.orderId));
  const visibleRequests = requests.filter((request) => !activeReviewIds.has(request.id));

  const [valueCardMembers, demographics] = await Promise.all([
    searchValueCardMembers(staff.organizationId!, visibleRequests.map((request) => request.customerPhone)),
    getOrderDemographicsForOrders(visibleRequests.map((request) => request.id)),
  ]);

  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Guest approval</span><h1>Заявки на билеты</h1><p>Проверяйте клиента, меняйте статус прямо в списке и связывайтесь с ним через WhatsApp.</p></div><span className="office-live"><i />Обновляется автоматически</span></div><RequestInbox initialRequests={visibleRequests.map((request) => {
    const previous = request.guest?.orders.filter((order) => order.id !== request.id) ?? [];
    const visits = previous.flatMap((order) => order.tickets).filter((ticket) => ticket.scans.length > 0).length;
    const paymentRecovery = request.status === "PAID" && recoveryIds.has(request.id);
    const demographic = demographics.get(request.id);
    const genders = demographic?.gender ? [demographic.gender] : [];
    return { id: request.id, publicId: request.publicId, customerName: request.customerName, customerEmail: request.customerEmail, customerPhone: request.customerPhone, valueCardMember: Boolean(valueCardMembers.get(request.customerPhone)), genders, birthDate: request.customerBirthDate?.toISOString() ?? demographic?.birthDate?.toISOString() ?? request.guest?.birthDate.toISOString() ?? null, city: request.customerCity ?? request.guest?.city ?? null, facebook: request.customerFacebook ?? request.guest?.facebook ?? null, instagram: request.customerInstagram ?? request.guest?.instagram ?? null, guestStatus: request.guest?.status ?? null, previousOrders: previous.length, previousVisits: visits, answer: request.eligibilityAnswer, status: paymentRecovery ? "PENDING_APPROVAL" : request.status, paymentRecovery, eventTitle: request.event.title, eventDate: request.event.startsAt.toISOString(), createdAt: request.createdAt.toISOString(), expiresAt: request.event.startsAt.toISOString(), inactive: false, totalMinor: request.totalMinor, items: request.items.map((item) => ({ name: item.categoryName, quantity: item.quantity })) };
  })}/></AdminShell>;
}
