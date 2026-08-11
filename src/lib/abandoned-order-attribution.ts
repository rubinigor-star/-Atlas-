import { db } from "@/lib/db";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

let attributionReady: Promise<void> | null = null;

async function ensureAttributionRuntime() {
  await ensureAbandonedCheckoutRuntime();
  if (!attributionReady) attributionReady = (async () => {
    await db.$executeRawUnsafe(`ALTER TABLE "AbandonedCheckout" ADD COLUMN IF NOT EXISTS "resumedAt" TIMESTAMP(3)`);
    await db.$executeRawUnsafe(`ALTER TABLE "AbandonedCheckout" ADD COLUMN IF NOT EXISTS "promoterLinkId" TEXT`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AbandonedCheckout_promoter_status_idx" ON "AbandonedCheckout"("promoterLinkId","status","lastActivityAt")`);
    await db.$executeRawUnsafe(`UPDATE "AbandonedCheckout" c SET "promoterLinkId"=p."id" FROM "PromoterLink" p WHERE c."promoterLinkId" IS NULL AND c."eventId"=p."eventId" AND UPPER(COALESCE(c."metadataJson"::jsonb->>'referralCode',''))=UPPER(p."code")`);
  })().catch(error => { attributionReady = null; throw error; });
  return attributionReady;
}

export async function touchAbandonedCheckoutContext(token: string, eventId: string, referralCode?: string | null) {
  await ensureAttributionRuntime();
  await db.$executeRawUnsafe(
    `UPDATE "AbandonedCheckout" SET "resumedAt"=CASE WHEN "abandonedAt" IS NOT NULL THEN COALESCE("resumedAt",CURRENT_TIMESTAMP) ELSE "resumedAt" END,"updatedAt"=CURRENT_TIMESTAMP WHERE "token"=$1 AND "eventId"=$2 AND "status"='ACTIVE'`,
    token,
    eventId,
  );
  const code = referralCode?.trim();
  if (!code) return;
  const links = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "PromoterLink" WHERE "eventId"=$1 AND UPPER("code")=UPPER($2) LIMIT 1`,
    eventId,
    code,
  );
  if (links[0]) await db.$executeRawUnsafe(`UPDATE "AbandonedCheckout" SET "promoterLinkId"=$2 WHERE "token"=$1`, token, links[0].id);
}

export async function linkAbandonedCheckoutToOrder(token: string | undefined, orderId: string) {
  if (!token) return;
  await ensureAttributionRuntime();
  await db.$executeRawUnsafe(
    `UPDATE "AbandonedCheckout" SET "orderId"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "token"=$1 AND "status"='ACTIVE'`,
    token,
    orderId,
  );
}

export async function finalizeAbandonedCheckoutForOrder(orderId: string) {
  await ensureAttributionRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ id: string; abandonedAt: Date | null; resumedAt: Date | null }>>(
    `SELECT "id","abandonedAt","resumedAt" FROM "AbandonedCheckout" WHERE "orderId"=$1 ORDER BY "lastActivityAt" DESC LIMIT 1`,
    orderId,
  );
  const checkout = rows[0];
  if (!checkout) return { outcome: "NONE" as const };

  if (!checkout.abandonedAt || !checkout.resumedAt) {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM "RecoveryAction" WHERE "checkoutId"=$1`, checkout.id);
      await tx.$executeRawUnsafe(`DELETE FROM "AbandonedCheckout" WHERE "id"=$1`, checkout.id);
    });
    return { outcome: "NORMAL_PURCHASE" as const };
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE "AbandonedCheckout" SET "status"='RECOVERED',"recoveredAt"=CURRENT_TIMESTAMP,"stopReason"='PURCHASE_COMPLETED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "abandonedAt" IS NOT NULL AND "resumedAt" IS NOT NULL`,
      checkout.id,
    );
    await tx.$executeRawUnsafe(
      `UPDATE "RecoveryAction" SET "status"='CANCELLED',"error"='PURCHASE_COMPLETED',"updatedAt"=CURRENT_TIMESTAMP WHERE "checkoutId"=$1 AND "status"='PENDING'`,
      checkout.id,
    );
  });
  return { outcome: "RECOVERED" as const };
}

export async function completeAbandonedCheckoutWithoutSale(orderId: string, reason: string) {
  await ensureAttributionRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "AbandonedCheckout" WHERE "orderId"=$1 LIMIT 1`, orderId);
  const checkout = rows[0];
  if (!checkout) return;
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE "RecoveryAction" SET "status"='CANCELLED',"error"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "checkoutId"=$1 AND "status"='PENDING'`, checkout.id, reason);
    await tx.$executeRawUnsafe(`UPDATE "AbandonedCheckout" SET "status"='STOPPED',"stopReason"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, checkout.id, reason);
  });
}

export async function cleanupFalseRecoveredCheckouts() {
  await ensureAttributionRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "AbandonedCheckout" WHERE "status"='RECOVERED' AND "abandonedAt" IS NULL`,
  );
  if (!rows.length) return 0;
  const ids = rows.map((row) => row.id);
  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`DELETE FROM "RecoveryAction" WHERE "checkoutId" = ANY($1::text[])`, ids);
    await tx.$executeRawUnsafe(`DELETE FROM "AbandonedCheckout" WHERE "id" = ANY($1::text[])`, ids);
  });
  return ids.length;
}

export async function getAbandonedPromoterSources(checkoutIds: string[]) {
  await ensureAttributionRuntime();
  if (!checkoutIds.length) return [] as Array<{ checkoutId: string; promoterName: string; linkLabel: string; code: string }>;
  return db.$queryRawUnsafe<Array<{ checkoutId: string; promoterName: string; linkLabel: string; code: string }>>(
    `SELECT c."id" AS "checkoutId",p."name" AS "promoterName",pl."label" AS "linkLabel",pl."code" AS "code" FROM "AbandonedCheckout" c JOIN "PromoterLink" pl ON pl."id"=c."promoterLinkId" JOIN "Promoter" p ON p."id"=pl."promoterId" WHERE c."id" = ANY($1::text[])`,
    checkoutIds,
  );
}

export function recoveryCheckoutUrl(checkoutUrl: string, token: string) {
  const url = new URL(checkoutUrl);
  url.searchParams.set("recovery", token);
  return url.toString();
}
