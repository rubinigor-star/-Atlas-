import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { OrderRefundError, refundOrder, type OrderRefundInput } from "@/lib/order-refund-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const order = await db.order.findUnique({ where: { publicId: id }, select: { eventId: true } });
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
    await requireEventAccess("ORDER_MANAGE", order.eventId);

    const body = await request.json().catch(() => null) as OrderRefundInput | null;
    return NextResponse.json(await refundOrder(id, body || {}));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ошибка возврата";
    const status = error instanceof OrderRefundError
      ? error.status
      : error instanceof Error && error.message === "FORBIDDEN"
        ? 403
        : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
