import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { OrderRefundError, refundOrder, type OrderRefundInput } from "@/lib/order-refund-service";

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

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.role !== "ADMIN" && !user.permissionSet.has("ORDER_MANAGE")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { publicId } = await params;
  try {
    const order = await db.order.findUnique({
      where: { publicId },
      select: { eventId: true, event: { select: { organizationId: true } } },
    });
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    if (!canAccessEvent(user, order.eventId, order.event.organizationId)) {
      return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
    }

    const body = await request.json().catch(() => null) as OrderRefundInput | null;
    return NextResponse.json(await refundOrder(publicId, body || {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка возврата";
    const status = error instanceof OrderRefundError ? error.status : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
