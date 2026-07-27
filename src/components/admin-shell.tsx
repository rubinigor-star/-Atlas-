import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { roleLabels } from "@/lib/permissions";
import { OfficeNavigation } from "@/components/office-navigation";
import { OfficeAccountMenu } from "@/components/office-account-menu";
import { OfficeLanguageSwitch } from "@/components/office-language-switch";
import { AtlasLogo } from "@/components/atlas-logo";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/office/login");
  if (!staff.organizationId || !staff.organization) redirect("/office/login?error=NO_ORGANIZATION");
  return <div className="office-shell">
    <aside className="office-sidebar"><AtlasLogo office /><div className="office-org"><i>{staff.organization.name.slice(0,1)}</i><div><strong>{staff.organization.name}</strong><small>{roleLabels[staff.staffRole??"CUSTOM"]}</small></div></div><OfficeLanguageSwitch /><OfficeNavigation permissions={[...staff.permissionSet]}/><OfficeAccountMenu currentEmail={staff.email} currentName={staff.name}/></aside>
    <main className="office-main"><header className="office-mobile-header"><AtlasLogo office /><div style={{display:"flex",alignItems:"center",gap:8}}><OfficeLanguageSwitch compact /><OfficeAccountMenu compact currentEmail={staff.email} currentName={staff.name}/></div></header>{children}</main>
    <OfficeNavigation mobile permissions={[...staff.permissionSet]}/>
  </div>;
}
