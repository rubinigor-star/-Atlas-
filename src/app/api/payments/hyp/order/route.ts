import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hypResultFromUrl, verifyHypCallback } from "@/lib/hyp-yaadpay";
import { commitReservation, releaseReservation } from "@/lib/reservation";
import { issueTicketsForOrder } from "@/lib/ticket-engine";
import { sendOrderTicketEmail } from "@/lib/order-email";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";

function orderRedirect(requestUrl: URL, publicId: string, state: string) {
  const base = (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin).replace(/\/$/, "");
  return NextResponse.redirect(`${base}/orders/${encodeURIComponent(publicId)}?payment=${encodeURIComponent(state)}`);
}

async function attributeRecoveredCheckout(order: { id: string; eventId: string; customerEmail: string }) {
  await ensureAbandonedCheckoutRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "AbandonedCheckout" WHERE "eventId"=$1 AND LOWER("customerEmail")=LOWER($2) AND "status"='ACTIVE' ORDER BY "lastActivityAt" DESC LIMIT 1`, order.eventId, order.customerEmail);
  const checkoutId = rows[0]?.id;
  if (!checkoutId) return;
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE "AbandonedCheckout" SET "status"='RECOVERED',"orderId"=$2,"recoveredAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, checkoutId, order.id);
    await tx.$executeRawUnsafe(`UPDATE "RecoveryAction" SET "status"='CANCELLED',"updatedAt"=CURRENT_TIMESTAMP WHERE "checkoutId"=$1 AND "status"='PENDING'`, checkoutId);
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = hypResultFromUrl(url);
  const publicId = result.orderId;
  if (!publicId) return NextResponse.redirect(new URL("/payments/hyp/result?payment=missing-order", url.origin));

  const order = await db.order.findUnique({ where: { publicId }, include: { items: true } });
  if (!order) return NextResponse.redirect(new URL("/payments/hyp/result?payment=unknown-order", url.origin));
  if (order.status === "PAID") return orderRedirect(url, publicId, "success");

  const signatureValid = await verifyHypCallback(url).catch(() => false);
  const returnedMinor = Math.round(Number(result.amount || "0") * 100);
  if (!signatureValid || !result.success || returnedMinor !== order.totalMinor) {
    if (!result.success) {
      await db.$transaction(async (tx) => {
        await releaseReservation(order.id, tx);
        await tx.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      });
    }
    return orderRedirect(url, publicId, signatureValid ? "failed" : "invalid-signature");
  }

  await db.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: order.id }, include: { items: true, tickets: true } });
    if (!current || current.status === "PAID") return;
    if (current.status !== "PENDING") throw new Error("ORDER_NOT_PAYABLE");

    for (const item of current.items) {
      const category = await tx.ticketCategory.findUnique({ where: { eventId_name: { eventId: current.eventId, name: item.categoryName } } });
      if (!category) throw new Error(`CATEGORY_NOT_FOUND:${item.categoryName}`);
      if (category.sold + item.quantity > category.capacity) throw new Error(`CATEGORY_SOLD_OUT:${item.categoryName}`);
      await tx.ticketCategory.update({ where: { id: category.id }, data: { sold: { increment: item.quantity } } });
      if (item.tableId) await tx.table.update({ where: { id: item.tableId }, data: { reserved: true } });
      if (item.seatId) await tx.seat.update({ where: { id: item.seatId }, data: { status: "RESERVED" } });
    }

    await tx.order.update({ where: { id: current.id }, data: { status: "PAID", paymentDueAt: null } });
    await commitReservation(current.id, tx);

    const authorizationId = `auth_${randomUUID().replace(/-/g, "")}`;
    const providerReference = result.transactionId || `hyp_${randomUUID().replace(/-/g, "")}`;
    const last4 = result.cardMask.replace(/\D/g, "").slice(-4) || null;
    await tx.$executeRaw`
      INSERT INTO PaymentAuthorization (
        id, orderId, provider, providerReference, method, status,
        amountMinor, currency, cardLast4, authorizedAt, capturedAt, expiresAt, createdAt, updatedAt
      ) VALUES (
        ${authorizationId}, ${current.id}, 'HYP', ${providerReference}, 'HOSTED_PAGE', 'CAPTURED',
        ${current.totalMinor}, ${current.currency}, ${last4}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP + INTERVAL '10 years', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT (orderId) DO NOTHING
    `;
    await issueTicketsForOrder(current.id, tx);
  });

  try { await attributeRecoveredCheckout(order); } catch (error) { console.error("[abandon-recovery-attribution]", publicId, error); }
  try { await sendOrderTicketEmail(publicId); } catch (error) { console.error("[hyp-ticket-email]", publicId, error); }
  return orderRedirect(url, publicId, "success");
}
