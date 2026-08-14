import Link from "next/link";
import { PlugZap } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureOrganizationIntegrationsTable } from "@/lib/organization-integrations";

export const dynamic = "force-dynamic";

type IntegrationRow = { enabled: number | boolean; credentialsEncrypted: string | null };

export default async function IntegrationsPage() {
  const staff = await requirePermission("FINANCE_VIEW");
  await ensureOrganizationIntegrationsTable();
  const rows = await db.$queryRaw<IntegrationRow[]>`
    SELECT "enabled", "credentialsEncrypted"
    FROM "OrganizationIntegration"
    WHERE "organizationId" = ${staff.organizationId!} AND "provider" = 'VALUECARD'
    LIMIT 1
  `;
  const valueCard = rows[0];
  const connected = Boolean(valueCard?.enabled && valueCard?.credentialsEncrypted);

  return <AdminShell>
    <section className="workspace-hero">
      <div>
        <span className="eyebrow">Настройки организации</span>
        <h1>Интеграции</h1>
        <p>Подключайте внешние сервисы только для своей организации.</p>
      </div>
    </section>
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 18 }}>
      <Link href="/office/integrations/valuecard" className="panel" style={{ padding: 24, textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#eef2ff", display: "grid", placeItems: "center" }}><PlugZap size={24} /></div>
          <div style={{ flex: 1 }}>
            <div className="row between" style={{ alignItems: "center" }}><h2 style={{ margin: 0 }}>ValueCard</h2><span className="pill">{connected ? "Подключено" : "Не подключено"}</span></div>
            <p className="muted" style={{ marginBottom: 0 }}>Проверка участников клуба и регистрация новых клиентов после одобрения заявки.</p>
          </div>
        </div>
      </Link>
    </section>
  </AdminShell>;
}
