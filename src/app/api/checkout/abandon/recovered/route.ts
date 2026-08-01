import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureAbandonedCheckoutRuntime, markAbandonedCheckoutRecovered } from "@/lib/abandoned-checkout";

const schema = z.object({ token: z.string().uuid(), orderId: z.string().min(1).max(100) });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await ensureAbandonedCheckoutRuntime();
    const order = await db.order.findUnique({ where: { publicId: input.orderId }, select: { id: true, eventId: true } });
    if (!order) return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    const rows = await db.$queryRawUnsafe<Array<{ eventId: string }>>(`SELECT "eventId" FROM "AbandonedCheckout" WHERE "token"=$1 LIMIT 1`, input.token);
    if (!rows[0] || rows[0].eventId !== order.eventId) return NextResponse.json({ error: "CHECKOUT_MISMATCH" }, { status: 409 });
    await markAbandonedCheckoutRecovered(input.token, order.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INVALID_REQUEST" }, { status: 400 });
  }
}
