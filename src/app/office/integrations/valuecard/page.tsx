import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { ValueCardIntegrationForm } from "@/components/valuecard-integration-form";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureOrganizationIntegrationsTable } from "@/lib/organization-integrations";
import { resolveStaffLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type IntegrationRow = { enabled: number | boolean; credentialsEncrypted: string | null };
const copy={ru:{back:"← Интеграции",description:"Подключение программы лояльности для"},he:{back:"← אינטגרציות",description:"חיבור מועדון הלקוחות עבור"},en:{back:"← Integrations",description:"Loyalty program integration for"}} as const;

export default async function ValueCardIntegrationPage() {
  const staff = await requirePermission("TEAM_MANAGE");
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text=copy[locale];
  await ensureOrganizationIntegrationsTable();
  const rows = await db.$queryRaw<IntegrationRow[]>`SELECT "enabled", "credentialsEncrypted" FROM "OrganizationIntegration" WHERE "organizationId" = ${staff.organizationId!} AND "provider" = 'VALUECARD' LIMIT 1`;
  const integration = rows[0];
  return <AdminShell><section className="workspace-hero"><div><Link href="/office/integrations" className="muted" style={{textDecoration:"none"}}>{text.back}</Link><h1 style={{marginTop:10}}>ValueCard</h1><p>{text.description} {staff.organization?.name || "Atlas"}.</p></div></section><ValueCardIntegrationForm initialEnabled={Boolean(integration?.enabled)} configured={Boolean(integration?.credentialsEncrypted)}/></AdminShell>;
}
