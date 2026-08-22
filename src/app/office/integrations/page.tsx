import Link from "next/link";
import { PlugZap } from "lucide-react";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureOrganizationIntegrationsTable } from "@/lib/organization-integrations";
import { resolveStaffLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";
type IntegrationRow = { enabled: number | boolean; credentialsEncrypted: string | null };

const copy = {
  ru:{eyebrow:"Настройки организации",title:"Интеграции",description:"Подключайте внешние сервисы только для своей организации.",connected:"Подключено",disconnected:"Не подключено",valueCard:"Проверка участников клуба и регистрация новых клиентов после одобрения заявки."},
  he:{eyebrow:"הגדרות הארגון",title:"אינטגרציות",description:"חברו שירותים חיצוניים רק לארגון שלכם.",connected:"מחובר",disconnected:"לא מחובר",valueCard:"בדיקת חברות במועדון ורישום לקוחות חדשים לאחר אישור הבקשה."},
  en:{eyebrow:"Organization settings",title:"Integrations",description:"Connect external services only for your organization.",connected:"Connected",disconnected:"Not connected",valueCard:"Check club membership and register new customers after an approval request is accepted."},
} as const;

export default async function IntegrationsPage() {
  const staff = await requirePermission("TEAM_MANAGE");
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text=copy[locale];
  await ensureOrganizationIntegrationsTable();
  const rows = await db.$queryRaw<IntegrationRow[]>`SELECT "enabled", "credentialsEncrypted" FROM "OrganizationIntegration" WHERE "organizationId" = ${staff.organizationId!} AND "provider" = 'VALUECARD' LIMIT 1`;
  const valueCard = rows[0];
  const connected = Boolean(valueCard?.enabled && valueCard?.credentialsEncrypted);
  return <AdminShell><section className="workspace-hero"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.description}</p></div></section><section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:18}}><Link href="/office/integrations/valuecard" className="panel" style={{padding:24,textDecoration:"none",color:"inherit",display:"block"}}><div style={{display:"flex",alignItems:"center",gap:14}}><div style={{width:48,height:48,borderRadius:14,background:"#eef2ff",display:"grid",placeItems:"center",flex:"0 0 auto"}}><PlugZap size={24}/></div><div style={{flex:1,minWidth:0}}><div className="row between" style={{alignItems:"center",gap:12}}><h2 style={{margin:0}}>ValueCard</h2><span className="pill">{connected?text.connected:text.disconnected}</span></div><p className="muted" style={{marginBottom:0}}>{text.valueCard}</p></div></div></Link></section></AdminShell>;
}
