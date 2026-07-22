import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { TeamManager } from "@/components/team-manager";
import { allPermissions, permissionLabels, roleLabels } from "@/lib/permissions";

export const dynamic="force-dynamic";
export default async function TeamPage(){const current=await requirePermission("TEAM_MANAGE");const [staff,events]=await Promise.all([db.user.findMany({where:{organizationId:current.organizationId!},include:{permissions:true,eventAccess:true},orderBy:{createdAt:"asc"}}),db.event.findMany({where:{organizationId:current.organizationId!},select:{id:true,title:true},orderBy:{startsAt:"asc"}})]);return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Access control</span><h1>Команда и права</h1><p>Каждый сотрудник видит только разрешённые инструменты и мероприятия.</p></div></div><TeamManager currentUserId={current.id} initialStaff={staff.map(member=>({id:member.id,name:member.name,email:member.email,jobTitle:member.jobTitle,staffRole:member.staffRole??"CUSTOM",active:member.active,permissions:member.permissions.map(grant=>grant.permission),eventIds:member.eventAccess.map(access=>access.eventId)}))} events={events} permissionLabels={permissionLabels} roleLabels={roleLabels} allPermissions={allPermissions}/></AdminShell>}
