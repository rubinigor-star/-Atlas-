import Link from "next/link";
import {redirect} from "next/navigation";
import {AtlasLogo} from "@/components/atlas-logo";
import {OfficeAccountMenu} from "@/components/office-account-menu";
import {requirePlatformAdmin} from "@/lib/auth";
import {getServerI18n} from "@/lib/server-locale";

const copy={ru:{role:"Суперадминистратор Atlas",overview:"Обзор платформы",finance:"Финансы",organizers:"Организаторы",events:"Все мероприятия",homepage:"Главная страница",sms:"Интеграции - SMS"},he:{role:"מנהל מערכת ראשי של Atlas",overview:"סקירת הפלטפורמה",finance:"כספים",organizers:"מפיקים",events:"כל האירועים",homepage:"עמוד הבית",sms:"אינטגרציות - SMS"},en:{role:"Atlas super administrator",overview:"Platform overview",finance:"Finance",organizers:"Organizers",events:"All events",homepage:"Homepage",sms:"Integrations - SMS"}} as const;
export async function PlatformShell({children}:{children:React.ReactNode}){const[admin,{locale}]=await Promise.all([requirePlatformAdmin().catch(()=>null),getServerI18n()]);if(!admin)redirect("/office/login");const t=copy[locale];return <div className="platform-shell"><aside className="platform-sidebar"><AtlasLogo office/><div className="platform-role-card"><span>PLATFORM ADMIN</span><strong>{admin.name}</strong><small>{t.role}</small></div><nav className="platform-nav"><Link href="/platform">{t.overview}</Link><Link href="/platform/finance">{t.finance}</Link><Link href="/platform/organizers">{t.organizers}</Link><Link href="/platform/events">{t.events}</Link><Link href="/platform/homepage">{t.homepage}</Link><Link href="/platform/integrations/sms">{t.sms}</Link></nav><OfficeAccountMenu currentEmail={admin.email} currentName={admin.name}/></aside><main className="platform-main">{children}</main></div>}
