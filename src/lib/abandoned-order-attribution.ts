import { db } from "@/lib/db";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

export async function linkAbandonedCheckoutToOrder(token: string | undefined, orderId: string) {
  if (!token) return;
  await ensureAbandonedCheckoutRuntime();
  await db.$executeRawUnsafe(
    `UPDATE "AbandonedCheckout" SET "orderId"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "token"=$1 AND "status"='ACTIVE'`,
    token,
    orderId,
  );
}

export async function finalizeAbandonedCheckoutForOrder(orderId: string) {
  await ensureAbandonedCheckoutRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ id: string; abandonedAt: Date | null }>>(
    `SELECT "id","abandonedAt" FROM "AbandonedCheckout" WHERE "orderId"=$1 ORDER BY "lastActivityAt" DESC LIMIT 1`,
    orderId,
  );
  const checkout = rows[0];
  if (!checkout) return { outcome: "NONE" as const };

  if (!checkout.abandonedAt) {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`DELETE FROM "RecoveryAction" WHERE "checkoutId"=$1`, checkout.id);
      await tx.$executeRawUnsafe(`DELETE FROM "AbandonedCheckout" WHERE "id"=$1`, checkout.id);
    });
    return { outcome: "NORMAL_PURCHASE" as const };
  }

  await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `UPDATE "AbandonedCheckout" SET "status"='RECOVERED',"recoveredAt"=CURRENT_TIMESTAMP,"stopReason"='PURCHASE_COMPLETED',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "abandonedAt" IS NOT NULL`,
      checkout.id,
    );
    await tx.$executeRawUnsafe(
      `UPDATE "RecoveryAction" SET "status"='CANCELLED',"error"='PURCHASE_COMPLETED',"updatedAt"=CURRENT_TIMESTAMP WHERE "checkoutId"=$1 AND "status"='PENDING'`,
      checkout.id,
    );
  });
  return { outcome: "RECOVERED" as const };
}

export async function cleanupFalseRecoveredCheckouts() {
  await ensureAbandonedCheckoutRuntime();
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
