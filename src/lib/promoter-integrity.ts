import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

/**
 * Promoters are business/financial records. They are archived, never physically
 * deleted. The runtime guard therefore does two things:
 * 1) prevents an Organization delete from cascading into Promoter;
 * 2) blocks direct DELETE against Promoter from any branch, script or client.
 */
export async function ensurePromoterIntegrityRuntime() {
  if (!ready) {
    ready = (async () => {
      const rows = await db.$queryRawUnsafe<Array<{ name: string; definition: string }>>(`
        SELECT c.conname AS name, pg_get_constraintdef(c.oid) AS definition
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'f'
          AND n.nspname = current_schema()
          AND t.relname = 'Promoter'
          AND pg_get_constraintdef(c.oid) LIKE '%("organizationId")%'
        LIMIT 1
      `);
      const existing = rows[0];
      if (existing && !/ON DELETE RESTRICT|ON DELETE NO ACTION/i.test(existing.definition)) {
        const safeName = existing.name.replace(/"/g, '""');
        await db.$executeRawUnsafe(`ALTER TABLE "Promoter" DROP CONSTRAINT "${safeName}"`);
        await db.$executeRawUnsafe(`
          ALTER TABLE "Promoter"
          ADD CONSTRAINT "Promoter_organizationId_fkey"
          FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
          ON DELETE RESTRICT ON UPDATE CASCADE
        `);
        console.info('[promoter-integrity] Replaced Organization cascade delete with RESTRICT');
      }

      await db.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION atlas_block_promoter_delete()
        RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'Physical deletion of Promoter is forbidden. Archive the promoter instead.'
            USING ERRCODE = 'P0001';
        END;
        $$ LANGUAGE plpgsql
      `);
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS atlas_block_promoter_delete_trigger ON "Promoter"`);
      await db.$executeRawUnsafe(`
        CREATE TRIGGER atlas_block_promoter_delete_trigger
        BEFORE DELETE ON "Promoter"
        FOR EACH ROW EXECUTE FUNCTION atlas_block_promoter_delete()
      `);
      console.info('[promoter-integrity] Physical Promoter DELETE is blocked at database level');
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

/**
 * Promoter auth tables were introduced as runtime tables and intentionally do
 * not have a hard FK yet. If an old destructive reset removed Promoter while
 * leaving PromoterAccount behind, the unique email index blocks a new invite.
 * Rebind only when the previous promoter row is genuinely gone. Never steal an
 * active account from another existing promoter.
 */
export async function repairOrphanedPromoterAccount(promoterId: string, email: string) {
  const normalized = email.trim().toLowerCase();
  const rows = await db.$queryRawUnsafe<Array<{ promoterId: string; promoterExists: boolean }>>(`
    SELECT a."promoterId", (p."id" IS NOT NULL) AS "promoterExists"
    FROM "PromoterAccount" a
    LEFT JOIN "Promoter" p ON p."id" = a."promoterId"
    WHERE LOWER(a."email") = LOWER($1)
    LIMIT 1
  `, normalized);
  const existing = rows[0];
  if (!existing || existing.promoterId === promoterId) return;
  if (existing.promoterExists) {
    throw new Error("Этот email уже используется другим промоутером Atlas");
  }

  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE "PromoterAccount" SET "promoterId"=$2,"email"=$3,"status"='PENDING',"passwordHash"=NULL,"activatedAt"=NULL,"lastLoginAt"=NULL,"updatedAt"=CURRENT_TIMESTAMP WHERE "promoterId"=$1`, existing.promoterId, promoterId, normalized);
    await tx.$executeRawUnsafe(`UPDATE "PromoterAuthToken" SET "promoterId"=$2,"usedAt"=CURRENT_TIMESTAMP WHERE "promoterId"=$1`, existing.promoterId, promoterId);
    await tx.$executeRawUnsafe(`DELETE FROM "PromoterSession" WHERE "promoterId"=$1`, existing.promoterId);
  });
  console.info('[promoter-integrity] Rebound orphaned promoter account', { oldPromoterId: existing.promoterId, promoterId });
}
