import { db } from "@/lib/db";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

export async function refreshAbandonedCheckoutStatuses() {
  await ensureAbandonedCheckoutRuntime();

  const updated = await db.$queryRawUnsafe<Array<{ id: string }>>(`
    UPDATE "AbandonedCheckout" c
    SET
      "abandonedAt" = COALESCE(c."abandonedAt", c."lastActivityAt"),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE c."status" = 'ACTIVE'
      AND c."abandonedAt" IS NULL
      AND c."optOutAt" IS NULL
      AND (c."customerEmail" IS NOT NULL OR c."customerPhone" IS NOT NULL)
      AND EXISTS (
        SELECT 1
        FROM "RecoveryScenario" s
        WHERE s."active" = TRUE
          AND s."organizationId" = c."organizationId"
          AND (s."eventId" = c."eventId" OR s."eventId" IS NULL)
          AND c."lastActivityAt" <= CURRENT_TIMESTAMP - make_interval(mins => s."abandonAfterMinutes")
      )
    RETURNING c."id"
  `);

  return updated.length;
}

export async function stopAbandonedCheckoutReminders(checkoutId: string, organizationId: string) {
  await ensureAbandonedCheckoutRuntime();

  return db.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>(
      `UPDATE "AbandonedCheckout"
       SET "status"='STOPPED',"stopReason"='MANUAL_STOP',"updatedAt"=CURRENT_TIMESTAMP
       WHERE "id"=$1 AND "organizationId"=$2 AND "status"='ACTIVE'
       RETURNING "id"`,
      checkoutId,
      organizationId,
    );

    if (!rows[0]) return false;

    await tx.$executeRawUnsafe(
      `UPDATE "RecoveryAction"
       SET "status"='CANCELLED',"error"='MANUAL_STOP',"updatedAt"=CURRENT_TIMESTAMP
       WHERE "checkoutId"=$1 AND "status"='PENDING'`,
      checkoutId,
    );

    return true;
  });
}
