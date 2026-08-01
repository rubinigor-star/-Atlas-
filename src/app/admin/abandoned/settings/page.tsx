import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { AbandonedSettingsForm } from "@/components/abandoned-settings-form";
import { requirePermission } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AbandonedSettingsPage(){
  await requirePermission("ANALYTICS_VIEW");
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Recovery Center</span><h1>Настройки сценария</h1><p>Управление автоматическими письмами для незавершённых покупок.</p></div><Link href="/office/abandoned" prefetch={false} className="btn">Назад к списку</Link></div>
    <AbandonedSettingsForm/>
  </AdminShell>;
}
