import Link from "next/link";
import { redirect } from "next/navigation";
import { AtlasLogo } from "@/components/atlas-logo";
import { OfficeAccountMenu } from "@/components/office-account-menu";
import { requirePlatformAdmin } from "@/lib/auth";

export async function PlatformShell({children}:{children:React.ReactNode}){
  const admin=await requirePlatformAdmin().catch(()=>null);
  if(!admin)redirect("/office/login");
  return <div className="platform-shell">
    <aside className="platform-sidebar">
      <AtlasLogo office />
      <div className="platform-role-card"><span>PLATFORM ADMIN</span><strong>{admin.name}</strong><small>Суперадминистратор Atlas</small></div>
      <nav className="platform-nav">
        <Link href="/platform">Обзор платформы</Link>
        <Link href="/platform/organizers">Организаторы</Link>
        <Link href="/platform/events">Все мероприятия</Link>
        <Link href="/platform/homepage">Главная страница</Link>
        <Link href="/platform/integrations/sms">Интеграции - SMS</Link>
      </nav>
      <OfficeAccountMenu currentEmail={admin.email} currentName={admin.name}/>
    </aside>
    <main className="platform-main">{children}</main>
  </div>;
}
