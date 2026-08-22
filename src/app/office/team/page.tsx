import { db } from "@/lib/db";
import { getOfficeCredentialStatus, getStaffEventScope, requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { TeamManager } from "@/components/team-manager";
import { allPermissions, permissionLabelsByLocale, roleLabelsByLocale, rolePermissions } from "@/lib/permissions";
import { resolveStaffLocale } from "@/lib/i18n";

export const dynamic="force-dynamic";
export default async function TeamPage(){
  const current=await requirePermission("TEAM_MANAGE");
  const [staff,events]=await Promise.all([
    db.user.findMany({where:{organizationId:current.organizationId!},include:{permissions:true,eventAccess:true},orderBy:{createdAt:"asc"}}),
    db.event.findMany({where:{organizationId:current.organizationId!},select:{id:true,title:true},orderBy:{startsAt:"asc"}}),
  ]);
  const [scopes,credentialStatuses]=await Promise.all([
    Promise.all(staff.map(member=>member.staffRole==="OWNER"?Promise.resolve("ALL" as const):getStaffEventScope(member.id))),
    Promise.all(staff.map(member=>getOfficeCredentialStatus(member.id))),
  ]);
  const locale=resolveStaffLocale({memberOverride:current.interfaceLocaleOverride,userPreference:current.preferredLocale,organizationDefault:current.organization?.defaultStaffLocale});
  return <AdminShell><TeamManager currentUserId={current.id} currentUserRole={current.staffRole??"CUSTOM"} organizationDefaultLocale={current.organization?.defaultStaffLocale??"ru"} initialStaff={staff.map((member,index)=>({id:member.id,name:member.name,email:member.email,jobTitle:member.jobTitle,staffRole:member.staffRole??"CUSTOM",interfaceLocaleOverride:member.interfaceLocaleOverride,active:member.active,permissions:member.permissions.map(grant=>grant.permission),eventIds:member.eventAccess.map(access=>access.eventId),eventScope:scopes[index],credentialExists:credentialStatuses[index]?.exists??false}))} events={events} permissionLabels={permissionLabelsByLocale[locale]} roleLabels={roleLabelsByLocale[locale]} allPermissions={allPermissions} rolePermissions={rolePermissions}/></AdminShell>;
}
