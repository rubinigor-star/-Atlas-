import { db } from "@/lib/db";

let ready: Promise<void> | null = null;

export function ensureOrganizationIntegrationsTable() {
  if (ready) return ready;
  ready = (async () => {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "OrganizationIntegration" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "enabled" BOOLEAN NOT NULL DEFAULT false,
        "credentialsEncrypted" TEXT,
        "lastTestStatus" TEXT,
        "lastTestedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationIntegration_organizationId_provider_key" ON "OrganizationIntegration"("organizationId", "provider")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrganizationIntegration_organizationId_enabled_idx" ON "OrganizationIntegration"("organizationId", "enabled")`);
  })().catch(error => {
    ready = null;
    throw error;
  });
  return ready;
}
