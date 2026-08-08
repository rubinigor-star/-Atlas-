import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hypApprovalResultFromUrl, verifyHypApprovalResponseMac } from "@/lib/hyp-creditguard";
import { releaseReservation } from "@/lib/reservation";
import { sendApprovalRequestReceivedEmail } from "@/lib/order-status-email";

export const dynamic = "force-dynamic";

type CallbackMode = "browser" | "server";
type State = "authorized" | "cancelled" | "failed" | "invalid-signature" | "missing-transaction" | "missing-order" | "unknown-order" | "wrong-mode";

let paymentColumnsReady: Promise<void> | undefined;
function ensurePaymentIdentifierColumns() {
  paymentColumnsReady ??= (async () => {
    const statements = [
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTransId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCgUid" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTxId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypUniqueId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypAuthorizationCode" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCardToken" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCardExp" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "providerResponseCode" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "providerPayloadJson" TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAuthorization_hypTransId_key" ON "PaymentAuthorization"("hypTransId") WHERE "hypTransId" IS NOT NULL`,
    ];
    for (const statement of statements) await db.$executeRawUnsafe(statement);
  })().catch((error) => { paymentColumnsReady = undefined; throw error; });
  return paymentColumnsReady;
}

function publicOrigin(requestUrl: URL) {
  return process.env.VERCEL_ENV === "production" ? "https://www.atlas-one.co" : requestUrl.origin;
}
function redirectToOrder(requestUrl: URL, publicId: string, state: State) {
  return NextResponse.redirect(`${publicOrigin(requestUrl)}/orders/${encodeURIComponent(publicId)}?payment=${encodeURIComponent(state)}`);
}
function redirectToResult(requestUrl: URL, state: State) {
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

async function saveAuthorization(order: { id: string; totalMinor: number; currency: string }, result: ReturnType<typeof hypApprovalResultFromUrl>) {
  await ensurePaymentIdentifierColumns();
  const transId = result.transId.trim();
  const authorizationId = `auth_${randomUUID().replace(/-/g, "")}`;
  const last4 = result.cardMask.replace(/\D/g, "").slice(-4) || null;
  await db.$executeRawUnsafe(
    `INSERT INTO "PaymentAuthorization" (
      "id","orderId","provider","providerReference","method","status","amountMinor","currency","cardLast4",
      "hypTransId","hypCgUid","hypTxId","hypUniqueId","hypAuthorizationCode","hypCardToken","hypCardExp","providerResponseCode","providerPayloadJson",
      "authorizedAt","capturedAt","expiresAt","createdAt","updatedAt"
    ) VALUES ($1,$2,'HYP',$3,'HOSTED_PAGE','AUTHORIZED',$4,$5,$6,$3,NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),NULLIF($12,''),NULLIF($13,''),$14,
      CURRENT_TIMESTAMP,NULL,CURRENT_TIMESTAMP + INTERVAL '24 hours',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("orderId") DO UPDATE SET
      "provider"='HYP',
      "providerReference"=EXCLUDED."providerReference",
      "status"='AUTHORIZED',
      "amountMinor"=EXCLUDED."amountMinor",
      "currency"=EXCLUDED."currency",
      "hypTransId"=EXCLUDED."hypTransId",
      "hypCgUid"=EXCLUDED."hypCgUid",
      "hypTxId"=EXCLUDED."hypTxId",
      "hypUniqueId"=EXCLUDED."hypUniqueId",
      "hypAuthorizationCode"=EXCLUDED."hypAuthorizationCode",
      "hypCardToken"=COALESCE(EXCLUDED."hypCardToken","PaymentAuthorization"."hypCardToken"),
      "hypCardExp"=COALESCE(EXCLUDED."hypCardExp","PaymentAuthorization"."hypCardExp"),
      "providerResponseCode"=EXCLUDED."providerResponseCode",
      "providerPayloadJson"=EXCLUDED."providerPayloadJson",
      "cardLast4"=COALESCE(EXCLUDED."cardLast4","PaymentAuthorization"."cardLast4"),
      "authorizedAt"=CURRENT_TIMESTAMP,
      "capturedAt"=NULL,
      "expiresAt"=CURRENT_TIMESTAMP + INTERVAL '24 hours',
      "updatedAt"=CURRENT_TIMESTAMP`,
    authorizationId, order.id, transId, order.totalMinor, order.currency, last4,
    result.cgUid, result.txId, result.uniqueId, result.authorizationCode, result.cardToken, result.cardExp, result.code, JSON.stringify(result.raw),
  );
}

async function cancelPendingCheckout(order: { id: string; status: string }) {
  if (order.status !== "PENDING") return;
  await db.$transaction(async (tx) => {
    await releaseReservation(order.id, tx);
    await tx.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  });
}

async function finalizeAuthorization(url: URL) {
  const result = hypApprovalResultFromUrl(url);
  const publicId = result.orderId;
  if (!publicId) return { publicId: "", state: "missing-order" as State };
  const order = await db.order.findUnique({ where: { publicId }, include: { event: true } });
  if (!order) return { publicId, state: "unknown-order" as State };
  if (order.event.salesMode !== "APPROVAL_REQUIRED") return { publicId, state: "wrong-mode" as State };

  if (result.outcome === "cancel") {
    await cancelPendingCheckout(order);
    console.info("hyp.approval.authorization_cancelled_by_customer", { publicId, code: result.code });
    return { publicId, state: "cancelled" as State };
  }

  if (!result.success) {
    console.error("hyp.approval.authorization_failed", { publicId, outcome: result.outcome, code: result.code });
    return { publicId, state: "failed" as State };
  }

  const returnedMinor = Number.isFinite(Number(result.amount)) ? Math.round(Number(result.amount) * 100) : -1;
  const amountMatches = returnedMinor === order.totalMinor;
  const signatureValid = await verifyHypApprovalResponseMac(url);
  const hasRequiredPaymentData = Boolean(result.transId && result.authorizationCode);
  if (!signatureValid || !hasRequiredPaymentData || !amountMatches) {
    console.error("hyp.approval.authorization_rejected", {
      publicId,
      signatureValid,
      amountMatches,
      returnedMinor,
      expectedMinor: order.totalMinor,
      hasTransId: Boolean(result.transId),
      hasAuthorizationCode: Boolean(result.authorizationCode),
      hasCardToken: Boolean(result.cardToken),
      hasCardExp: Boolean(result.cardExp),
      code: result.code,
    });
    return { publicId, state: !signatureValid ? "invalid-signature" as State : !hasRequiredPaymentData ? "missing-transaction" as State : "failed" as State };
  }

  if (order.status === "PENDING_APPROVAL") {
    await saveAuthorization(order, result);
    return { publicId, state: "authorized" as State, alreadyAuthorized: true };
  }
  if (order.status !== "PENDING") return { publicId, state: "failed" as State };

  await saveAuthorization(order, result);
  const changed = await db.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "PENDING_APPROVAL", reviewedAt: null, paymentDueAt: null } });
  if (changed.count === 1) {
    try { await sendApprovalRequestReceivedEmail(publicId); }
    catch (error) { console.error("[approval-request-email]", { publicId, message: error instanceof Error ? error.message : "Unknown email error" }); }
  }
  console.info("hyp.approval.authorized", {
    publicId,
    transId: result.transId,
    authorizationCode: result.authorizationCode || null,
    providerCode: result.code,
    returnedMinor,
    amountMinor: order.totalMinor,
  });
  return { publicId, state: "authorized" as State, alreadyAuthorized: changed.count === 0 };
}

async function handleCallback(request: Request, mode: CallbackMode) {
  try {
    const url = await requestToCallbackUrl(request);
    const result = await finalizeAuthorization(url);
    if (mode === "server") return NextResponse.json({ ok: result.state === "authorized", ...result }, { status: result.state === "authorized" ? 200 : 400 });
    return result.publicId ? redirectToOrder(url, result.publicId, result.state) : redirectToResult(url, result.state);
  } catch (error) {
    console.error("hyp.approval.callback_failed", { method: request.method, message: error instanceof Error ? error.message : "Unknown callback error" });
    if (mode === "server") return NextResponse.json({ ok: false, error: "callback-failed" }, { status: 500 });
    return redirectToResult(new URL(request.url), "failed");
  }
}

export async function GET(request: Request) { return handleCallback(request, "browser"); }
export async function POST(request: Request) { return handleCallback(request, "server"); }
