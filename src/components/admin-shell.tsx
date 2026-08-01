import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { roleLabels } from "@/lib/permissions";
import { OfficeNavigation } from "@/components/office-navigation";
import { OfficeAccountMenu } from "@/components/office-account-menu";
import { OfficeLanguageSwitch } from "@/components/office-language-switch";
import { AtlasLogo } from "@/components/atlas-logo";
import { ConceptSwitcher } from "@/components/concept-switcher";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/office/login");
  if (staff.role === "ADMIN") redirect("/platform");
  if (!staff.organizationId || !staff.organization) redirect("/office/login?error=NO_ORGANIZATION");

  const staffTitle = staff.staffRole ? roleLabels[staff.staffRole] : "Сотрудник";

  return <div className="office-shell">
    <aside className="office-sidebar">
      <AtlasLogo office />
      <div className="office-org">
        <i>{staff.organization.name.slice(0, 1)}</i>
        <div>
          <strong>{staff.organization.name}</strong>
          <small>Организатор</small>
        </div>
      </div>
      <OfficeLanguageSwitch />
      <OfficeNavigation permissions={[...staff.permissionSet]} />
      <OfficeAccountMenu currentName={staff.name} currentRole={staffTitle} />
    </aside>

    <main className="office-main">
      <header className="office-mobile-header">
        <AtlasLogo office />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <OfficeLanguageSwitch compact />
          <OfficeAccountMenu compact currentName={staff.name} currentRole={staffTitle} />
        </div>
      </header>
      <ConceptSwitcher />
      {children}
    </main>

    <OfficeNavigation mobile permissions={[...staff.permissionSet]} />
  </div>;
}
