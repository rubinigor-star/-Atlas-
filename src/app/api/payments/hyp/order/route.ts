import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hypResultFromUrl, verifyHypCallback } from "@/lib/hyp-yaadpay";
import { commitReservation, releaseReservation } from "@/lib/reservation";
import { issueTicketsForOrder } from "@/lib/ticket-engine";
import { sendOrderTicketEmail } from "@/lib/order-email";
import { sendOrderTicketSms } from "@/lib/order-sms";
import { finalizeAbandonedCheckoutForOrder } from "@/lib/abandoned-order-attribution";

export const dynamic = "force-dynamic";

type CallbackMode = "browser" | "server";
type FinalizeResult = {
  publicId: string;
  state: "success" | "failed" | "invalid-signature" | "missing-transaction" | "missing-order" | "unknown-order";
  alreadyPaid?: boolean;
};

let paymentColumnsReady: Promise<void> | undefined;

function ensurePaymentIdentifierColumns() {
  paymentColumnsReady ??= (async () => {
    const statements = [
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTransId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCgUid" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTxId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypUniqueId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "providerResponseCode" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "providerPayloadJson" TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAuthorization_hypTransId_key" ON "PaymentAuthorization"("hypTransId") WHERE "hypTransId" IS NOT NULL`,
    ];
    for (const statement of statements) await db.$executeRawUnsafe(statement);
  })().catch((error) => {
    paymentColumnsReady = undefined;
    throw error;
  });
  return paymentColumnsReady;
}

function publicOrigin(requestUrl: URL) {
  return process.env.VERCEL_ENV === "production" ? "https://www.atlas-one.co" : requestUrl.origin;
}
function orderRedirect(requestUrl: URL, publicId: string, state: string) {
  return NextResponse.redirect(`${publicOrigin(requestUrl)}/orders/${encodeURIComponent(publicId)}?payment=${encodeURIComponent(state)}`);
}
function resultRedirect(requestUrl: URL, state: string) {
  return NextResponse.redirect(`${publicOrigin(requestUrl)}/payments/hyp/result?payment=${encodeURIComponent(state)}`);
}

async function requestToCallbackUrl(request: Request) {
  const url = new URL(request.url);
  if (request.method !== "POST") return url;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = await request.text();
    for (const [key, value] of new URLSearchParams(body).entries()) url.searchParams.append(key, value);
  } else if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (body) for (const [key, value] of Object.entries(body)) if (value !== undefined && value !== null) url.searchParams.append(key, String(value));
  }
  return url;
}

async function upsertAuthorization(order: { id: string; totalMinor: number; currency: string }, result: ReturnType<typeof hypResultFromUrl>) {
  const transId = result.transId.trim();
  if (!transId) return;
  await ensurePaymentIdentifierColumns();
  const authorizationId = `auth_${randomUUID().replace(/-/g, "")}`;
  const last4 = result.cardMask.replace(/\D/g, "").slice(-4) || null;
  await db.$executeRawUnsafe(
    `INSERT INTO "PaymentAuthorization" (
      "id","orderId","provider","providerReference","method","status","amountMinor","currency","cardLast4",
      "hypTransId","hypCgUid","hypTxId","hypUniqueId","providerResponseCode","providerPayloadJson",
      "authorizedAt","capturedAt","expiresAt","createdAt","updatedAt"
    ) VALUES ($1,$2,'HYP',$3,'HOSTED_PAGE','CAPTURED',$4,$5,$6,$3,NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),$11,
      CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + INTERVAL '10 years',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("orderId") DO UPDATE SET
      "providerReference"=EXCLUDED."providerReference",
      "hypTransId"=EXCLUDED."hypTransId",
      "hypCgUid"=EXCLUDED."hypCgUid",
      "hypTxId"=EXCLUDED."hypTxId",
      "hypUniqueId"=EXCLUDED."hypUniqueId",
      "providerResponseCode"=EXCLUDED."providerResponseCode",
      "providerPayloadJson"=EXCLUDED."providerPayloadJson",
      "cardLast4"=COALESCE(EXCLUDED."cardLast4","PaymentAuthorization"."cardLast4"),
      "updatedAt"=CURRENT_TIMESTAMP`,
    authorizationId, order.id, transId, order.totalMinor, order.currency, last4,
    result.cgUid, result.txId, result.uniqueId, result.code, JSON.stringify(result.raw),
  );
}

async function finalizeCallback(url: URL): Promise<FinalizeResult> {
  const result = hypResultFromUrl(url);
  const publicId = result.orderId;
  if (!publicId) return { publicId: "", state: "missing-order" };
  const order = await db.order.findUnique({ where: { publicId }, include: { items: true } });
  if (!order) return { publicId, state: "unknown-order" };

  const signatureValid = await verifyHypCallback(url).catch(() => false);
  const returnedMinor = Math.round(Number(result.amount || "0") * 100);
  const transId = result.transId.trim();

  if (order.status === "PAID") {
    if (signatureValid && result.success && returnedMinor === order.totalMinor && transId) {
      await upsertAuthorization(order, result);
      console.info("hyp.authorization.upserted", { publicId, transId, alreadyPaid: true });
    }
    return { publicId, state: "success", alreadyPaid: true };
  }

  if (!signatureValid || !result.success || returnedMinor !== order.totalMinor || !transId) {
    console.error("hyp.order.rejected", { publicId, signatureValid, success: result.success, returnedMinor, expectedMinor: order.totalMinor, hasTransId: Boolean(transId), code: result.code });
    if (!result.success) {
      await db.$transaction(async (tx) => {
        await releaseReservation(order.id, tx);
        await tx.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
      });
    }
    return { publicId, state: !signatureValid ? "invalid-signature" : !transId ? "missing-transaction" : "failed" };
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
    await issueTicketsForOrder(current.id, tx);
    finalized = true;
  });

  await upsertAuthorization(order, result);
  console.info("hyp.order.finalized", { publicId, transId, cgUid: result.cgUid || null, txId: result.txId || null, amountMinor: order.totalMinor, finalized });
  if (finalized) {
    try { await finalizeAbandonedCheckoutForOrder(order.id); } catch (error) { console.error("[abandon-recovery-attribution]", publicId, error); }
    try { await sendOrderTicketEmail(publicId); } catch (error) { console.error("[hyp-ticket-email]", publicId, error); }
    try { await sendOrderTicketSms(publicId, { automatic: true }); } catch (error) { console.error("[hyp-ticket-sms]", publicId, error); }
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
