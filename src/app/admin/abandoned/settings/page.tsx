import Link from "next/link";
import {AdminShell} from "@/components/admin-shell";
import {AbandonedSettingsForm} from "@/components/abandoned-settings-form";
import {requirePermission} from "@/lib/auth";
import {resolveStaffLocale} from "@/lib/i18n";

export const dynamic="force-dynamic";
const copy={ru:{title:"Настройки сценария",help:"Управление автоматическими письмами для незавершённых покупок.",back:"Назад к списку"},he:{title:"הגדרות תהליך",help:"ניהול הודעות אוטומטיות עבור רכישות שלא הושלמו.",back:"חזרה לרשימה"},en:{title:"Recovery settings",help:"Manage automated messages for incomplete purchases.",back:"Back to list"}} as const;
export default async function AbandonedSettingsPage(){const staff=await requirePermission("ANALYTICS_VIEW");const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});const text=copy[locale];return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Recovery Center</span><h1>{text.title}</h1><p>{text.help}</p></div><Link href="/office/abandoned" prefetch={false} className="btn">{text.back}</Link></div><AbandonedSettingsForm/></AdminShell>}
