import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const body = await request.json().catch(() => null) as { email?: string; amountMinor?: number; reason?: string } | null;
  const email = body?.email?.trim().toLowerCase() || "";
  const amountMinor = Number(body?.amountMinor);
  const reason = body?.reason?.trim() || "";
  if (!email || !Number.isInteger(amountMinor) || amountMinor <= 0 || reason.length < 3) {
    return NextResponse.json({ error: "Проверьте данные запроса" }, { status: 400 });
  }

  const order = await db.order.findUnique({ where: { publicId } });
  if (!order || order.customerEmail.trim().toLowerCase() !== email) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }
  if (order.status !== "PAID") return NextResponse.json({ error: "Возврат доступен только для оплаченного заказа" }, { status: 409 });
  if (amountMinor > order.totalMinor) return NextResponse.json({ error: "Сумма превышает сумму заказа" }, { status: 400 });

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "RefundRequest" ("id","orderId","customerEmail","amountMinor","reason","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,'PENDING',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      `rr_${randomUUID().replace(/-/g, "")}`, order.id, order.customerEmail, amountMinor, reason,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "По этому заказу уже есть запрос на рассмотрении" }, { status: 409 });
  }
}
