import { db } from "@/lib/db";
import { getOfficeCredentialStatus, getStaffEventScope, requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { TeamManager } from "@/components/team-manager";
import { allPermissions, permissionLabels, roleLabels, rolePermissions } from "@/lib/permissions";

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
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Access control</span><h1>Команда и права</h1><p>Каждый сотрудник видит только разрешённые инструменты и мероприятия. Владелец защищён от изменения роли.</p></div></div><TeamManager currentUserId={current.id} currentUserRole={current.staffRole??"CUSTOM"} initialStaff={staff.map((member,index)=>({id:member.id,name:member.name,email:member.email,jobTitle:member.jobTitle,staffRole:member.staffRole??"CUSTOM",active:member.active,permissions:member.permissions.map(grant=>grant.permission),eventIds:member.eventAccess.map(access=>access.eventId),eventScope:scopes[index],credentialExists:credentialStatuses[index]?.exists??false}))} events={events} permissionLabels={permissionLabels} roleLabels={roleLabels} allPermissions={allPermissions} rolePermissions={rolePermissions}/></AdminShell>;
}
