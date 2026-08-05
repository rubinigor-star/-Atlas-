import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hypResultFromUrl, verifyHypCallback } from "@/lib/hyp-yaadpay";
import { commitReservation, releaseReservation } from "@/lib/reservation";
import { issueTicketsForOrder } from "@/lib/ticket-engine";
import { sendOrderTicketEmail } from "@/lib/order-email";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

export const dynamic = "force-dynamic";
type CallbackMode = "browser" | "server";
type FinalizeResult = { publicId: string; state: "success" | "failed" | "invalid-signature" | "missing-transaction" | "missing-order" | "unknown-order"; alreadyPaid?: boolean };

function publicOrigin(requestUrl: URL) {
  return process.env.VERCEL_ENV === "production" ? "https://www.atlas-one.co" : requestUrl.origin;
}
function orderRedirect(requestUrl: URL, publicId: string, state: string) {
  return NextResponse.redirect(`${publicOrigin(requestUrl)}/orders/${encodeURIComponent(publicId)}?payment=${encodeURIComponent(state)}`);
}
function resultRedirect(requestUrl: URL, state: string) {
  return NextResponse.redirect(`${publicOrigin(requestUrl)}/payments/hyp/result?payment=${encodeURIComponent(state)}`);
}

async function attributeRecoveredCheckout(order: { id: string; eventId: string; customerEmail: string }) {
  await ensureAbandonedCheckoutRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "AbandonedCheckout" WHERE "eventId"=$1 AND LOWER("customerEmail")=LOWER($2) AND "status"='ACTIVE' ORDER BY "lastActivityAt" DESC LIMIT 1`,
    order.eventId, order.customerEmail,
  );
  const checkoutId = rows[0]?.id;
  if (!checkoutId) return;
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`UPDATE "AbandonedCheckout" SET "status"='RECOVERED',"orderId"=$2,"recoveredAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, checkoutId, order.id);
    await tx.$executeRawUnsafe(`UPDATE "RecoveryAction" SET "status"='CANCELLED',"updatedAt"=CURRENT_TIMESTAMP WHERE "checkoutId"=$1 AND "status"='PENDING'`, checkoutId);
  });
}

async function requestToCallbackUrl(request: Request) {
  const url = new URL(request.url);
  if (request.method !== "POST") return url;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const params = new URLSearchParams(await request.text());
    for (const [key, value] of params.entries()) url.searchParams.append(key, value);
  } else if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (body) for (const [key, value] of Object.entries(body)) if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
  }
  return url;
}

async function finalizeCallback(url: URL): Promise<FinalizeResult> {
  const result = hypResultFromUrl(url);
  const publicId = result.orderId;
  if (!publicId) return { publicId: "", state: "missing-order" };
  const order = await db.order.findUnique({ where: { publicId }, include: { items: true } });
  if (!order) return { publicId, state: "unknown-order" };
  if (order.status === "PAID") return { publicId, state: "success", alreadyPaid: true };

  const signatureValid = await verifyHypCallback(url).catch(() => false);
  const returnedMinor = Math.round(Number(result.amount || "0") * 100);
  const providerReference = (result.cgUid || result.tranId || result.txId || result.transactionId).trim();
  if (!signatureValid || !result.success || returnedMinor !== order.totalMinor || !providerReference) {
    console.error("hyp.order.rejected", { publicId, signatureValid, success: result.success, returnedMinor, expectedMinor: order.totalMinor, hasProviderReference: Boolean(providerReference), code: result.code });
    if (!result.success) {
      await db.$transaction(async (tx) => {
        await releaseReservation(order.id, tx);
        await tx.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      });
    }
    return { publicId, state: !signatureValid ? "invalid-signature" : !providerReference ? "missing-transaction" : "failed" };
  }

  let finalized = false;
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
    const last4 = result.cardMask.replace(/\D/g, "").slice(-4) || null;
    await tx.$executeRawUnsafe(
      `INSERT INTO "PaymentAuthorization" ("id","orderId","provider","providerReference","cgUid","tranId","txId","method","status","amountMinor","currency","cardLast4","authorizedAt","capturedAt","expiresAt","createdAt","updatedAt") VALUES ($1,$2,'HYP',$3,$4,$5,$6,'HOSTED_PAGE','CAPTURED',$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '10 years',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("orderId") DO UPDATE SET "providerReference"=EXCLUDED."providerReference","cgUid"=COALESCE(EXCLUDED."cgUid","PaymentAuthorization"."cgUid"),"tranId"=COALESCE(EXCLUDED."tranId","PaymentAuthorization"."tranId"),"txId"=COALESCE(EXCLUDED."txId","PaymentAuthorization"."txId"),"updatedAt"=CURRENT_TIMESTAMP`,
      authorizationId, current.id, providerReference, result.cgUid || null, result.tranId || null, result.txId || null, current.totalMinor, current.currency, last4,
    );
    await issueTicketsForOrder(current.id, tx);
    finalized = true;
  });

  console.info("hyp.order.finalized", { publicId, providerReference, cgUid: Boolean(result.cgUid), tranId: Boolean(result.tranId), txId: Boolean(result.txId), amountMinor: order.totalMinor, finalized });
  if (finalized) {
    try { await attributeRecoveredCheckout(order); } catch (error) { console.error("[abandon-recovery-attribution]", publicId, error); }
    try { await sendOrderTicketEmail(publicId); } catch (error) { console.error("[hyp-ticket-email]", publicId, error); }
  }
  return { publicId, state: "success", alreadyPaid: !finalized };
}

async function handleCallback(request: Request, mode: CallbackMode) {
  try {
    const url = await requestToCallbackUrl(request);
    const result = await finalizeCallback(url);
    if (mode === "server") return NextResponse.json({ ok: result.state === "success", ...result }, { status: result.state === "success" ? 200 : 400 });
    return result.publicId ? orderRedirect(url, result.publicId, result.state) : resultRedirect(url, result.state);
  } catch (error) {
    console.error("hyp.order.callback_failed", { method: request.method, message: error instanceof Error ? error.message : "Unknown callback error" });
    if (mode === "server") return NextResponse.json({ ok: false, error: "callback-failed" }, { status: 500 });
    return resultRedirect(new URL(request.url), "callback-failed");
  }
}

export async function GET(request: Request) { return handleCallback(request, "browser"); }
export async function POST(request: Request) { return handleCallback(request, "server"); }
