import { after } from "next/server";
import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin-shell";
import { RequestInbox } from "@/components/request-inbox";
import { requirePermission } from "@/lib/auth";
import { getActiveOrderReviewJobIds } from "@/lib/order-review-queue";
import { getCachedSocialProfiles, normalizeSocialProfile, refreshSocialProfiles, type SocialProfileInput } from "@/lib/social-profile-image";

export const dynamic = "force-dynamic";

const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";

export default async function RequestsPage() {
  const staff = await requirePermission("REQUEST_REVIEW");

  const approvalOrderRows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT o."id"
     FROM "Order" o
     JOIN "Event" e ON e."id"=o."eventId"
     WHERE o."salesFlow"='APPROVAL'
       AND e."organizationId"=$1`,
    staff.organizationId!,
  );
  const approvalOrderIds = approvalOrderRows.map((row) => row.id);

  const requests = approvalOrderIds.length
    ? await db.order.findMany({
        where: {
          id: { in: approvalOrderIds },
          status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAID", "REJECTED", "CANCELLED"] },
          OR: [{ reviewNote: null }, { reviewNote: { not: DISMISSED_EXPIRED_NOTE } }],
        },
        include: { event: true, items: true, guest: { include: { orders: { include: { tickets: { include: { scans: true } } } } } } },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      })
    : [];

  const [recoveryRows, activeReviewIds] = await Promise.all([
    db.$queryRaw<Array<{ orderId: string }>>`
      SELECT pa."orderId"
      FROM "PaymentAuthorization" pa
      JOIN "Order" o ON o."id"=pa."orderId"
      WHERE o."salesFlow"='APPROVAL'
        AND pa.provider = 'HYP'
        AND pa.status = 'CAPTURED'
        AND pa."hypCaptureTransId" IS NULL
    `,
    getActiveOrderReviewJobIds(requests.map((request) => request.id)),
  ]);
  const recoveryIds = new Set(recoveryRows.map((row) => row.orderId));
  const visibleRequests = requests.filter((request) => !activeReviewIds.has(request.id));

  const socialInputs: SocialProfileInput[] = visibleRequests.flatMap((request) => [
    { kind: "INSTAGRAM" as const, value: request.customerInstagram ?? request.guest?.instagram ?? null },
    { kind: "FACEBOOK" as const, value: request.customerFacebook ?? request.guest?.facebook ?? null },
  ]);
  const socialCache = await getCachedSocialProfiles(socialInputs);
  after(async () => {
    await refreshSocialProfiles(socialInputs).catch((error) => {
      console.info("admin.requests.social_profile_refresh_failed", { message: error instanceof Error ? error.message : "Unknown error" });
    });
  });

  return (
    <AdminShell>
      <div className="office-page-heading">
        <div>
          <span className="eyebrow">Guest approval</span>
          <h1>Заявки на билеты</h1>
          <p>Проверяйте клиента, меняйте статус прямо в списке и связывайтесь с ним через WhatsApp.</p>
        </div>
        <span className="office-live"><i />Обновляется автоматически</span>
      </div>
      <RequestInbox
        initialRequests={visibleRequests.map((request) => {
          const previous = request.guest?.orders.filter((order) => order.id !== request.id) ?? [];
          const visits = previous.flatMap((order) => order.tickets).filter((ticket) => ticket.scans.length > 0).length;
          const paymentRecovery = request.status === "PAID" && recoveryIds.has(request.id);
          const rawInstagram = request.customerInstagram ?? request.guest?.instagram ?? null;
          const rawFacebook = request.customerFacebook ?? request.guest?.facebook ?? null;
          const instagram = normalizeSocialProfile({ kind: "INSTAGRAM", value: rawInstagram });
          const facebook = normalizeSocialProfile({ kind: "FACEBOOK", value: rawFacebook });
          const instagramImage = instagram ? socialCache.get(instagram.url)?.imageUrl ?? null : null;
          const facebookImage = facebook ? socialCache.get(facebook.url)?.imageUrl ?? null : null;
          return {
            id: request.id,
            publicId: request.publicId,
            customerName: request.customerName,
            customerEmail: request.customerEmail,
            customerPhone: request.customerPhone,
            birthDate: request.customerBirthDate?.toISOString() ?? request.guest?.birthDate.toISOString() ?? null,
            city: request.customerCity ?? request.guest?.city ?? null,
            facebook: facebook?.url ?? null,
            instagram: instagram?.url ?? null,
            profileImageUrl: instagramImage || facebookImage,
            profileImageSource: instagramImage ? "INSTAGRAM" : facebookImage ? "FACEBOOK" : null,
            guestStatus: request.guest?.status ?? null,
            previousOrders: previous.length,
            previousVisits: visits,
            answer: request.eligibilityAnswer,
            status: paymentRecovery ? "PENDING_APPROVAL" : request.status,
            paymentRecovery,
            eventTitle: request.event.title,
            eventDate: request.event.startsAt.toISOString(),
            createdAt: request.createdAt.toISOString(),
            expiresAt: request.event.startsAt.toISOString(),
            inactive: false,
            totalMinor: request.totalMinor,
            items: request.items.map((item) => ({ name: item.categoryName, quantity: item.quantity })),
          };
        })}
      />
    </AdminShell>
  );
}
