import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hypApprovalResultFromUrl, verifyHypApprovalResponseMac } from "@/lib/hyp-creditguard";
import { sendApprovalRequestReceivedEmail } from "@/lib/order-status-email";

export const dynamic = "force-dynamic";

let columnsReady: Promise<void> | undefined;
function ensureColumns() {
  columnsReady ??= (async () => {
    const statements = [
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTransId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypCgUid" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypTxId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypUniqueId" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "hypAuthorizationCode" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "providerResponseCode" TEXT`,
      `ALTER TABLE "PaymentAuthorization" ADD COLUMN IF NOT EXISTS "providerPayloadJson" TEXT`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAuthorization_hypTransId_key" ON "PaymentAuthorization"("hypTransId") WHERE "hypTransId" IS NOT NULL`,
    ];
    for (const statement of statements) await db.$executeRawUnsafe(statement);
  })().catch((error) => { columnsReady = undefined; throw error; });
  return columnsReady;
}

async function saveAuthorization(order: { id: string; totalMinor: number; currency: string }, result: ReturnType<typeof hypApprovalResultFromUrl>) {
  await ensureColumns();
  const transId = result.transId.trim();
  const id = `auth_${randomUUID().replace(/-/g, "")}`;
  const last4 = result.cardMask.replace(/\D/g, "").slice(-4) || null;
  await db.$executeRawUnsafe(
    `INSERT INTO "PaymentAuthorization" ("id","orderId","provider","providerReference","method","status","amountMinor","currency","cardLast4","hypTransId","hypCgUid","hypTxId","hypUniqueId","hypAuthorizationCode","providerResponseCode","providerPayloadJson","authorizedAt","capturedAt","expiresAt","createdAt","updatedAt")
     VALUES ($1,$2,'HYP',$3,'HOSTED_PAGE','AUTHORIZED',$4,$5,$6,$3,NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),$12,CURRENT_TIMESTAMP,NULL,CURRENT_TIMESTAMP + INTERVAL '24 hours',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("orderId") DO UPDATE SET "provider"='HYP',"providerReference"=EXCLUDED."providerReference","status"='AUTHORIZED',"amountMinor"=EXCLUDED."amountMinor","currency"=EXCLUDED."currency","cardLast4"=COALESCE(EXCLUDED."cardLast4","PaymentAuthorization"."cardLast4"),"hypTransId"=EXCLUDED."hypTransId","hypCgUid"=EXCLUDED."hypCgUid","hypTxId"=EXCLUDED."hypTxId","hypUniqueId"=EXCLUDED."hypUniqueId","hypAuthorizationCode"=EXCLUDED."hypAuthorizationCode","providerResponseCode"=EXCLUDED."providerResponseCode","providerPayloadJson"=EXCLUDED."providerPayloadJson","authorizedAt"=CURRENT_TIMESTAMP,"capturedAt"=NULL,"expiresAt"=CURRENT_TIMESTAMP + INTERVAL '24 hours',"updatedAt"=CURRENT_TIMESTAMP`,
    id, order.id, transId, order.totalMinor, order.currency, last4, result.cgUid, result.txId, result.uniqueId, result.authorizationCode, result.code, JSON.stringify(result.raw),
  );
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const result = hypApprovalResultFromUrl(url);
  const publicId = result.orderId;
  if (!publicId) return NextResponse.redirect(new URL("/payments/hyp/result?payment=missing-order", url));
  const order = await db.order.findUnique({ where: { publicId }, include: { event: true } });
  if (!order) return NextResponse.redirect(new URL(`/payments/hyp/result?payment=unknown-order`, url));
  if (order.event.salesMode !== "APPROVAL_REQUIRED") return NextResponse.redirect(new URL(`/orders/${encodeURIComponent(publicId)}?payment=failed`, url));

  const returnedMinor = Math.round(Number(result.amount || "0") * 100);
  const signatureValid = await verifyHypApprovalResponseMac(url);
  const valid = result.success && signatureValid && returnedMinor === order.totalMinor && Boolean(result.transId);
  if (!valid) {
    console.error("hyp.approval.authorization_rejected", { publicId, code: result.code, signatureValid, returnedMinor, expectedMinor: order.totalMinor, hasTransId: Boolean(result.transId) });
    return NextResponse.redirect(new URL(`/orders/${encodeURIComponent(publicId)}?payment=${signatureValid ? "failed" : "invalid-signature"}`, url));
  }

  await saveAuthorization(order, result);
  const changed = await db.order.updateMany({ where: { id: order.id, status: "PENDING" }, data: { status: "PENDING_APPROVAL", reviewedAt: null, paymentDueAt: null } });
  if (order.status !== "PENDING" && order.status !== "PENDING_APPROVAL") {
    return NextResponse.redirect(new URL(`/orders/${encodeURIComponent(publicId)}?payment=failed`, url));
  }
  if (changed.count === 1) {
    try { await sendApprovalRequestReceivedEmail(publicId); }
    catch (error) { console.error("approval-request-email.failed", { publicId, message: error instanceof Error ? error.message : "Unknown error" }); }
  }
  console.info("hyp.approval.authorized", { publicId, code: result.code, transId: result.transId, amountMinor: order.totalMinor });
  return NextResponse.redirect(new URL(`/orders/${encodeURIComponent(publicId)}?payment=authorized`, url));
}

export async function GET(request: Request) {
  try { return await handle(request); }
  catch (error) {
    console.error("hyp.approval.callback_failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.redirect(new URL("/payments/hyp/result?payment=callback-failed", request.url));
  }
}
