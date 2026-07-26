import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentStaff } from "@/lib/auth";
import { roleLabels } from "@/lib/permissions";
import { OfficeNavigation } from "@/components/office-navigation";
import { OfficeAccountMenu } from "@/components/office-account-menu";
import { OfficeLanguageSwitch } from "@/components/office-language-switch";
import { AtlasLogo } from "@/components/atlas-logo";
import { getServerI18n } from "@/lib/server-locale";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const [staff, i18n] = await Promise.all([getCurrentStaff(), getServerI18n()]);
  if (!staff?.organizationId || !staff.organization) return <main className="office-denied"><div><span>ATLAS ONE OFFICE</span><h1>{i18n.messages.office.denied}</h1><p>{i18n.messages.office.deniedText}</p><Link className="btn" href="/">{i18n.messages.office.backToSite}</Link></div></main>;
  const colleagues = await db.user.findMany({ where: { organizationId: staff.organizationId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, email: true, staffRole: true } });
  const accounts=colleagues.map(member=>({...member,staffRole:member.staffRole??"CUSTOM" as const}));
  return <div className="office-shell">
    <aside className="office-sidebar"><AtlasLogo office /><div className="office-org"><i>{staff.organization.name.slice(0,1)}</i><div><strong>{staff.organization.name}</strong><small>{roleLabels[staff.staffRole??"CUSTOM"]}</small></div></div><OfficeLanguageSwitch /><OfficeNavigation permissions={[...staff.permissionSet]}/><OfficeAccountMenu currentEmail={staff.email} currentName={staff.name} colleagues={accounts}/></aside>
    <main className="office-main"><header className="office-mobile-header"><AtlasLogo office /><div style={{display:"flex",alignItems:"center",gap:8}}><OfficeLanguageSwitch compact /><OfficeAccountMenu compact currentEmail={staff.email} currentName={staff.name} colleagues={accounts}/></div></header>{children}</main>
    <OfficeNavigation mobile permissions={[...staff.permissionSet]}/>
  </div>;
}
