import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { ValueCardIntegrationForm } from "@/components/valuecard-integration-form";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureOrganizationIntegrationsTable } from "@/lib/organization-integrations";

export const dynamic = "force-dynamic";

type IntegrationRow = { enabled: number | boolean; credentialsEncrypted: string | null };

export default async function ValueCardIntegrationPage() {
  const staff = await requirePermission("FINANCE_VIEW");
  await ensureOrganizationIntegrationsTable();
  const rows = await db.$queryRaw<IntegrationRow[]>`
    SELECT "enabled", "credentialsEncrypted"
    FROM "OrganizationIntegration"
    WHERE "organizationId" = ${staff.organizationId!} AND "provider" = 'VALUECARD'
    LIMIT 1
  `;
  const integration = rows[0];

  return <AdminShell>
    <section className="workspace-hero">
      <div>
        <Link href="/office/integrations" className="muted" style={{ textDecoration: "none" }}>← Интеграции</Link>
        <h1 style={{ marginTop: 10 }}>ValueCard</h1>
        <p>Подключение программы лояльности для {staff.organization?.name || "организации"}.</p>
      </div>
    </section>
    <ValueCardIntegrationForm initialEnabled={Boolean(integration?.enabled)} configured={Boolean(integration?.credentialsEncrypted)} />
  </AdminShell>;
}
