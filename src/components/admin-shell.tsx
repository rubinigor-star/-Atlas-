import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/auth";
import { roleLabelsByLocale } from "@/lib/permissions";
import { OfficeNavigation } from "@/components/office-navigation";
import { OfficeAccountMenu } from "@/components/office-account-menu";
import { OfficeLanguageSwitch } from "@/components/office-language-switch";
import { AtlasLogo } from "@/components/atlas-logo";
import { LocaleProvider } from "@/components/locale-provider";
import { localeConfig, resolveStaffLocale } from "@/lib/i18n";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const staff = await getCurrentStaff();
  if (!staff) redirect("/office/login");
  if (staff.role === "ADMIN") redirect("/platform");
  if (!staff.organizationId || !staff.organization) redirect("/office/login?error=NO_ORGANIZATION");

  const staffLocale = resolveStaffLocale({
    memberOverride: staff.interfaceLocaleOverride,
    userPreference: staff.preferredLocale,
    organizationDefault: staff.organization.defaultStaffLocale,
  });
  const staffTitle = staff.staffRole ? roleLabelsByLocale[staffLocale][staff.staffRole] : roleLabelsByLocale[staffLocale].CUSTOM;
  const organizerLabel=staffLocale==="he"?"מפיק":staffLocale==="en"?"Organizer":"Организатор";

  return <LocaleProvider key={staffLocale} initialLocale={staffLocale} scope="staff"><div className="office-shell" lang={localeConfig[staffLocale].tag} dir={localeConfig[staffLocale].dir}>
    <aside className="office-sidebar">
      <AtlasLogo office />
      <div className="office-org">
        <i>{staff.organization.name.slice(0, 1)}</i>
        <div>
          <strong>{staff.organization.name}</strong>
          <small>{organizerLabel}</small>
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
      {children}
    </main>

    <OfficeNavigation mobile permissions={[...staff.permissionSet]} />
  </div></LocaleProvider>;
}
