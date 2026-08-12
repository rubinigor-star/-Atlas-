import { db } from "@/lib/db";
import { AdminShell } from "@/components/admin-shell";
import { RequestInbox } from "@/components/request-inbox";
import { requirePermission } from "@/lib/auth";
import { getDismissedRequestIds } from "@/lib/request-dismissal";

export const dynamic = "force-dynamic";

const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";

type AuthorizationRow = {
  orderId: string;
  provider: string;
  status: string;
  hypTransId: string | null;
  hypCaptureTransId: string | null;
};

type ReservationRow = {
  orderId: string;
  status: string;
  expiresAt: Date;
};

async function runtimeRows<T>(table: "PaymentAuthorization" | "Reservation", orderIds: string[]) {
  if (!orderIds.length) return [] as T[];
  const placeholders = orderIds.map((_, index) => `$${index + 1}`).join(",");
  if (table === "PaymentAuthorization") {
    return db.$queryRawUnsafe<T[]>(
      `SELECT "orderId","provider","status","hypTransId","hypCaptureTransId" FROM "PaymentAuthorization" WHERE "orderId" IN (${placeholders})`,
      ...orderIds,
    );
  }
  return db.$queryRawUnsafe<T[]>(
    `SELECT "orderId","status","expiresAt" FROM "Reservation" WHERE "orderId" IN (${placeholders})`,
    ...orderIds,
  );
}

export default async function RequestsPage() {
  const staff = await requirePermission("REQUEST_REVIEW");
  const requests = await db.order.findMany({
    where: {
      status: { in: ["PENDING_APPROVAL", "AWAITING_PAYMENT", "PAID", "REJECTED", "CANCELLED"] },
      event: { organizationId: staff.organizationId! },
      OR: [{ reviewNote: null }, { reviewNote: { not: DISMISSED_EXPIRED_NOTE } }],
    },
    include: { event: true, items: true, guest: { include: { orders: { include: { tickets: { include: { scans: true } } } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const orderIds = requests.map((request) => request.id);
  const [authorizationRows, reservationRows, dismissedIds] = await Promise.all([
    runtimeRows<AuthorizationRow>("PaymentAuthorization", orderIds),
    runtimeRows<ReservationRow>("Reservation", orderIds),
    getDismissedRequestIds(orderIds),
  ]);
  const authorizationByOrder = new Map(authorizationRows.map((row) => [row.orderId, row]));
  const reservationByOrder = new Map(reservationRows.map((row) => [row.orderId, row]));
  const now = new Date();

  const liveRequests = requests.filter((request) => {
    if (dismissedIds.has(request.id)) return false;

    const authorization = authorizationByOrder.get(request.id);
    const reservation = reservationByOrder.get(request.id);

    if (request.status === "PENDING_APPROVAL") {
      if (request.event.salesMode !== "APPROVAL_REQUIRED") return false;
      const validAuthorization = Boolean(
        authorization
        && authorization.provider === "HYP"
        && authorization.status === "AUTHORIZED"
        && authorization.hypTransId,
      );
      const validReservation = Boolean(
        reservation
        && reservation.status === "ACTIVE"
        && new Date(reservation.expiresAt) > now,
      );
      return validAuthorization && validReservation;
    }

    if (
      request.status === "PAID"
      && request.event.salesMode === "APPROVAL_REQUIRED"
      && authorization?.provider === "HYP"
      && authorization.status === "CAPTURED"
      && !authorization.hypCaptureTransId
    ) {
      return false;
    }

    return true;
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
        initialRequests={liveRequests.map((request) => {
          const previous = request.guest?.orders.filter((order) => order.id !== request.id) ?? [];
          const visits = previous.flatMap((order) => order.tickets).filter((ticket) => ticket.scans.length > 0).length;
          const reservation = reservationByOrder.get(request.id);
          const reservationExpiresAt = reservation?.expiresAt ? new Date(reservation.expiresAt) : request.createdAt;

          return {
            id: request.id,
            publicId: request.publicId,
            customerName: request.customerName,
            customerEmail: request.customerEmail,
            customerPhone: request.customerPhone,
            birthDate: request.customerBirthDate?.toISOString() ?? request.guest?.birthDate.toISOString() ?? null,
            city: request.customerCity ?? request.guest?.city ?? null,
            facebook: request.customerFacebook ?? request.guest?.facebook ?? null,
            instagram: request.customerInstagram ?? request.guest?.instagram ?? null,
            guestStatus: request.guest?.status ?? null,
            previousOrders: previous.length,
            previousVisits: visits,
            answer: request.eligibilityAnswer,
            status: request.status,
            paymentRecovery: false,
            eventTitle: request.event.title,
            eventDate: request.event.startsAt.toISOString(),
            createdAt: request.createdAt.toISOString(),
            expiresAt: reservationExpiresAt.toISOString(),
            inactive: false,
            totalMinor: request.totalMinor,
            items: request.items.map((item) => ({ name: item.categoryName, quantity: item.quantity })),
          };
        })}
      />
    </AdminShell>
  );
}
