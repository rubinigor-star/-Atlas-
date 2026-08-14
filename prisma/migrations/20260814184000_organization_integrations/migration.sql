CREATE TABLE "OrganizationIntegration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "credentialsEncrypted" TEXT,
    "lastTestStatus" TEXT,
    "lastTestedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationIntegration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationIntegration_organizationId_provider_key" ON "OrganizationIntegration"("organizationId", "provider");
CREATE INDEX "OrganizationIntegration_organizationId_enabled_idx" ON "OrganizationIntegration"("organizationId", "enabled");
