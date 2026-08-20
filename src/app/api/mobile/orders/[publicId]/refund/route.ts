import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { getRefundPolicy, OrderRefundError, refundOrder, type OrderRefundInput } from "@/lib/order-refund-service";

function canAccessEvent(
  user: NonNullable<Awaited<ReturnType<typeof getMobileStaff>>>,
  eventId: string,
  organizationId: string,
) {
  if (user.role === "ADMIN") return true;
  if (!user.organizationId || user.organizationId !== organizationId) return false;
  const hasExplicitScope = user.eventAccess.length > 0;
  return !hasExplicitScope || user.eventAccess.some((access) => access.eventId === eventId);
}

async function authorizedOrder(request: Request, publicId: string) {
  const user = await getMobileStaff(request);
  if (!user) return { error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) } as const;
  if (user.role !== "ADMIN" && !user.permissionSet.has("ORDER_MANAGE")) {
    return { error: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }) } as const;
  }
  const order = await db.order.findUnique({
    where: { publicId },
    select: { id: true, status: true, totalMinor: true, eventId: true, event: { select: { organizationId: true } } },
  });
  if (!order) return { error: NextResponse.json({ error: "Заказ не найден" }, { status: 404 }) } as const;
  if (!canAccessEvent(user, order.eventId, order.event.organizationId)) {
    return { error: NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 }) } as const;
  }
  return { user, order } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const access = await authorizedOrder(request, publicId);
  if ("error" in access) return access.error;
  try {
    return NextResponse.json(await getRefundPolicy(publicId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка возврата";
    const status = error instanceof OrderRefundError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const access = await authorizedOrder(request, publicId);
  if ("error" in access) return access.error;

  try {
    const body = await request.json().catch(() => null) as OrderRefundInput | null;
    return NextResponse.json(await refundOrder(publicId, body || {}, { actorId: access.user.id }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка возврата";
    const status = error instanceof OrderRefundError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
