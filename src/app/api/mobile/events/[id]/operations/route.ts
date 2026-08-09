import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

const STATUS_GROUPS = {
  pending: ["PENDING", "PENDING_APPROVAL"] as const,
  approved: ["PAID"] as const,
  cancelled: ["CANCELLED", "REJECTED"] as const,
} as const;

type GroupKey = keyof typeof STATUS_GROUPS | "abandoned";
type SortKey = "newest" | "oldest" | "amount_desc" | "amount_asc";

type AuthorizationRow = {
  orderId: string;
  provider: string;
  status: string;
  amountMinor: number;
  hypTransId: string | null;
};

type ReservationRow = {
  orderId: string;
  status: string;
  expiresAt: Date;
};

type AbandonedRow = {
  id: string;
  token: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  quantity: number;
  amountMinor: number;
  lastActivityAt: Date;
  abandonedAt: Date;
  categoryName: string | null;
};

function groupFromUrl(url: URL): GroupKey {
  const value = url.searchParams.get("status");
  return value === "approved" || value === "cancelled" || value === "abandoned" ? value : "pending";
}

function sortFromUrl(url: URL): SortKey {
  const value = url.searchParams.get("sort");
  return value === "oldest" || value === "amount_desc" || value === "amount_asc" ? value : "newest";
}

function canAccessEvent(user: Awaited<ReturnType<typeof getMobileStaff>>, event: { id: string; organizationId: string }) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const organizationAccess = Boolean(user.organizationId && user.organizationId === event.organizationId);
  const hasExplicitScope = user.eventAccess.length > 0;
  const eventAccess = user.eventAccess.some((access) => access.eventId === event.id);
  return organizationAccess && (!hasExplicitScope || eventAccess);
}

function moneyReadiness(params: {
  orderStatus: string;
  orderTotalMinor: number;
  authorization?: AuthorizationRow;
  reservation?: ReservationRow;
}) {
  const { orderStatus, orderTotalMinor, authorization, reservation } = params;
  if (orderStatus !== "PENDING_APPROVAL") {
    return {
      canApprove: false,
      canReject: false,
      reviewBlockedReason: "Заявка ещё не готова к рассмотрению",
      paymentProvider: authorization?.provider ?? null,
      paymentAuthorizationStatus: authorization?.status ?? null,
      reservationStatus: reservation?.status ?? null,
    };
  }

  if (!authorization) {
    return {
      canApprove: false,
      canReject: false,
      reviewBlockedReason: reservation
        ? "Предварительная авторизация оплаты не найдена"
        : "Старая тестовая заявка без платежной авторизации",
      paymentProvider: null,
      paymentAuthorizationStatus: null,
      reservationStatus: reservation?.status ?? null,
    };
  }

  if (authorization.amountMinor !== orderTotalMinor) {
    return {
      canApprove: false,
      canReject: false,
      reviewBlockedReason: "Сумма авторизации не совпадает с суммой заказа",
      paymentProvider: authorization.provider,
      paymentAuthorizationStatus: authorization.status,
      reservationStatus: reservation?.status ?? null,
    };
  }

  if (authorization.provider !== "HYP" && authorization.provider !== "ATLAS_TEST") {
    return {
      canApprove: false,
      canReject: false,
      reviewBlockedReason: `Неподдерживаемый провайдер авторизации: ${authorization.provider}`,
      paymentProvider: authorization.provider,
      paymentAuthorizationStatus: authorization.status,
      reservationStatus: reservation?.status ?? null,
    };
  }

  if (authorization.status !== "AUTHORIZED") {
    return {
      canApprove: false,
      canReject: false,
      reviewBlockedReason: `Авторизация оплаты недоступна: ${authorization.status}`,
      paymentProvider: authorization.provider,
      paymentAuthorizationStatus: authorization.status,
      reservationStatus: reservation?.status ?? null,
    };
  }

  const reservationActive = Boolean(
    reservation && reservation.status === "ACTIVE" && new Date(reservation.expiresAt).getTime() > Date.now(),
  );

  return {
    canApprove: reservationActive,
    canReject: true,
    reviewBlockedReason: reservationActive ? null : "Срок резерва заявки истёк. Подтверждение оплаты заблокировано",
    paymentProvider: authorization.provider,
    paymentAuthorizationStatus: authorization.status,
    reservationStatus: reservation?.status ?? null,
  };
}

async function abandonedCount(eventId: string) {
  await ensureAbandonedCheckoutRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    `SELECT COUNT(*) AS count FROM "AbandonedCheckout" WHERE "eventId"=$1 AND "status"='ACTIVE' AND "abandonedAt" IS NOT NULL`,
    eventId,
  );
  return Number(rows[0]?.count ?? 0);
}

async function abandonedPage(params: {
  eventId: string;
  page: number;
  limit: number;
  query: string;
  category: string;
  sort: SortKey;
}) {
  await ensureAbandonedCheckoutRuntime();
  const values: unknown[] = [params.eventId];
  let where = `c."eventId"=$1 AND c."status"='ACTIVE' AND c."abandonedAt" IS NOT NULL`;

  if (params.query) {
    values.push(`%${params.query}%`);
    const n = values.length;
    where += ` AND (COALESCE(c."customerFirstName",'') ILIKE $${n} OR COALESCE(c."customerLastName",'') ILIKE $${n} OR COALESCE(c."customerEmail",'') ILIKE $${n} OR COALESCE(c."customerPhone",'') ILIKE $${n})`;
  }
  if (params.category) {
    values.push(params.category);
    where += ` AND tc."name"=$${values.length}`;
  }

  const orderBy = params.sort === "oldest"
    ? `c."lastActivityAt" ASC`
    : params.sort === "amount_desc"
      ? `c."amountMinor" DESC`
      : params.sort === "amount_asc"
        ? `c."amountMinor" ASC`
        : `c."lastActivityAt" DESC`;

  const countRows = await db.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    `SELECT COUNT(*) AS count FROM "AbandonedCheckout" c LEFT JOIN "TicketCategory" tc ON tc."id"=c."categoryId" WHERE ${where}`,
    ...values,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const rowValues = [...values, params.limit, (params.page - 1) * params.limit];
  const limitIndex = rowValues.length - 1;
  const offsetIndex = rowValues.length;
  const rows = await db.$queryRawUnsafe<AbandonedRow[]>(
    `SELECT c."id",c."token",c."customerFirstName",c."customerLastName",c."customerEmail",c."customerPhone",c."quantity",c."amountMinor",c."lastActivityAt",c."abandonedAt",tc."name" AS "categoryName"
     FROM "AbandonedCheckout" c
     LEFT JOIN "TicketCategory" tc ON tc."id"=c."categoryId"
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    ...rowValues,
  );

  return { rows, total };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!user.permissionSet.has("ORDER_VIEW") && user.role !== "ADMIN") {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await context.params;
  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      startsAt: true,
      posterUrl: true,
      organizationId: true,
      venue: { select: { name: true, city: true } },
      categories: { select: { name: true }, orderBy: { name: "asc" } },
    },
  });

  if (!event || !canAccessEvent(user, event)) {
    return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
  }

  const url = new URL(request.url);
  const group = groupFromUrl(url);
  const sort = sortFromUrl(url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(20, Number.parseInt(url.searchParams.get("limit") || "50", 10) || 50));
  const query = (url.searchParams.get("q") || "").trim();
  const category = (url.searchParams.get("category") || "").trim();

  const [groupedCounts, revenue, usedTickets, lostCount] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: { eventId: id }, _count: { _all: true } }),
    db.order.aggregate({ where: { eventId: id, status: "PAID" }, _sum: { totalMinor: true } }),
    db.ticket.count({ where: { status: "USED", order: { eventId: id, status: "PAID" } } }),
    abandonedCount(id),
  ]);

  const rawCounts = new Map<string, number>(groupedCounts.map((item) => [item.status, item._count._all]));
  const countGroup = (statuses: readonly string[]) => statuses.reduce((sum, status) => sum + (rawCounts.get(status) ?? 0), 0);
  const counts = {
    pending: countGroup(STATUS_GROUPS.pending),
    approved: countGroup(STATUS_GROUPS.approved),
    cancelled: countGroup(STATUS_GROUPS.cancelled),
    abandoned: lostCount,
  };

  const eventPayload = {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    posterUrl: event.posterUrl?.trim() || null,
    venue: event.venue,
    revenueMinor: revenue._sum.totalMinor ?? 0,
    checkedIn: usedTickets,
    categoryOptions: event.categories.map((item) => item.name),
  };

  if (group === "abandoned") {
    const abandoned = await abandonedPage({ eventId: id, page, limit, query, category, sort });
    return NextResponse.json({
      event: eventPayload,
      counts,
      group,
      pagination: { page, limit, total: abandoned.total, hasMore: page * limit < abandoned.total },
      orders: abandoned.rows.map((row) => ({
        id: row.id,
        publicId: row.token,
        customerName: [row.customerFirstName, row.customerLastName].filter(Boolean).join(" ") || "Не представился",
        customerPhone: row.customerPhone || "",
        customerEmail: row.customerEmail || "",
        totalMinor: row.amountMinor,
        currency: "ILS",
        status: "ABANDONED",
        reviewNote: null,
        createdAt: new Date(row.lastActivityAt).toISOString(),
        reviewedAt: null,
        ticketCount: row.quantity,
        categories: row.categoryName ? [{ name: row.categoryName, quantity: row.quantity, unitPriceMinor: row.quantity ? Math.round(row.amountMinor / row.quantity) : row.amountMinor }] : [],
        usedTickets: 0,
        source: "ABANDONED_CHECKOUT",
        canApprove: false,
        canReject: false,
        reviewBlockedReason: "Это брошенное оформление, а не оплаченный заказ",
        paymentProvider: null,
        paymentAuthorizationStatus: null,
        reservationStatus: null,
      })),
    });
  }

  const statuses = STATUS_GROUPS[group];
  const orderWhere = {
    eventId: id,
    status: { in: [...statuses] },
    ...(query ? {
      OR: [
        { customerName: { contains: query } },
        { customerPhone: { contains: query } },
        { customerEmail: { contains: query } },
        { publicId: { contains: query } },
      ],
    } : {}),
    ...(category ? { items: { some: { categoryName: category } } } : {}),
  };

  const orderBy = sort === "oldest"
    ? { createdAt: "asc" as const }
    : sort === "amount_desc"
      ? { totalMinor: "desc" as const }
      : sort === "amount_asc"
        ? { totalMinor: "asc" as const }
        : { createdAt: "desc" as const };

  const [orders, filteredTotal] = await Promise.all([
    db.order.findMany({
      where: orderWhere,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        publicId: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        totalMinor: true,
        currency: true,
        status: true,
        reviewNote: true,
        createdAt: true,
        reviewedAt: true,
        items: { select: { quantity: true, categoryName: true, unitPriceMinor: true } },
        tickets: { select: { id: true, status: true } },
      },
    }),
    db.order.count({ where: orderWhere }),
  ]);

  const orderIds = orders.map((order) => order.id);
  let authorizationRows: AuthorizationRow[] = [];
  let reservationRows: ReservationRow[] = [];
  if (orderIds.length) {
    const placeholders = orderIds.map((_, index) => `$${index + 1}`).join(",");
    [authorizationRows, reservationRows] = await Promise.all([
      db.$queryRawUnsafe<AuthorizationRow[]>(
        `SELECT "orderId","provider","status","amountMinor","hypTransId" FROM "PaymentAuthorization" WHERE "orderId" IN (${placeholders})`,
        ...orderIds,
      ).catch(() => []),
      db.$queryRawUnsafe<ReservationRow[]>(
        `SELECT "orderId","status","expiresAt" FROM "Reservation" WHERE "orderId" IN (${placeholders})`,
        ...orderIds,
      ).catch(() => []),
    ]);
  }
  const authorizationByOrder = new Map(authorizationRows.map((row) => [row.orderId, row]));
  const reservationByOrder = new Map(reservationRows.map((row) => [row.orderId, row]));

  return NextResponse.json({
    event: eventPayload,
    counts,
    group,
    pagination: { page, limit, total: filteredTotal, hasMore: page * limit < filteredTotal },
    orders: orders.map((order) => ({
      id: order.id,
      publicId: order.publicId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerEmail: order.customerEmail,
      totalMinor: order.totalMinor,
      currency: order.currency,
      status: order.status,
      reviewNote: order.reviewNote,
      createdAt: order.createdAt.toISOString(),
      reviewedAt: order.reviewedAt?.toISOString() ?? null,
      ticketCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      categories: order.items.map((item) => ({ name: item.categoryName, quantity: item.quantity, unitPriceMinor: item.unitPriceMinor })),
      usedTickets: order.tickets.filter((ticket) => ticket.status === "USED").length,
      source: "ORDER",
      ...moneyReadiness({
        orderStatus: order.status,
        orderTotalMinor: order.totalMinor,
        authorization: authorizationByOrder.get(order.id),
        reservation: reservationByOrder.get(order.id),
      }),
    })),
  });
}
