import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

/**
 * Promoters are business/financial records and must never disappear because an
 * Organization row is deleted or recreated. Older Atlas schemas used
 * ON DELETE CASCADE on Promoter.organizationId, which made a demo/reset seed
 * capable of silently destroying the complete promoter history.
 *
 * Keep this runtime guard until the constraint has been migrated everywhere.
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
      if (!existing || /ON DELETE RESTRICT|ON DELETE NO ACTION/i.test(existing.definition)) return;

      const safeName = existing.name.replace(/"/g, '""');
      await db.$executeRawUnsafe(`ALTER TABLE "Promoter" DROP CONSTRAINT "${safeName}"`);
      await db.$executeRawUnsafe(`
        ALTER TABLE "Promoter"
        ADD CONSTRAINT "Promoter_organizationId_fkey"
        FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
      `);
      console.info('[promoter-integrity] Replaced Organization cascade delete with RESTRICT');
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
