import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { roleLabels } from "@/lib/permissions";
import { OfficeNavigation } from "@/components/office-navigation";
import { OfficeAccountMenu } from "@/components/office-account-menu";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff?.organizationId || !staff.organization) return <main className="office-denied"><div><span>ATLAS OFFICE</span><h1>Доступ закрыт</h1><p>Выберите демонстрационного сотрудника организации или войдите в рабочий аккаунт.</p><Link className="btn" href="/">Вернуться на сайт</Link></div></main>;
  const colleagues = await db.user.findMany({ where: { organizationId: staff.organizationId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, staffRole: true } });
  const accounts=colleagues.map(member=>({...member,staffRole:member.staffRole??"CUSTOM" as const}));
  return <div className="office-shell">
    <aside className="office-sidebar"><Link className="office-brand" href="/office">ATL<span>AS</span><small>OFFICE</small></Link><div className="office-org"><i>{staff.organization.name.slice(0,1)}</i><div><strong>{staff.organization.name}</strong><small>{roleLabels[staff.staffRole??"CUSTOM"]}</small></div></div><OfficeNavigation permissions={[...staff.permissionSet]}/><OfficeAccountMenu currentEmail={staff.email} currentName={staff.name} colleagues={accounts}/></aside>
    <main className="office-main"><header className="office-mobile-header"><Link className="office-brand" href="/office">ATL<span>AS</span><small>OFFICE</small></Link><OfficeAccountMenu compact currentEmail={staff.email} currentName={staff.name} colleagues={accounts}/></header>{children}</main>
    <OfficeNavigation mobile permissions={[...staff.permissionSet]}/>
  </div>;
}
