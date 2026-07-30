import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { getCurrentStaff } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PlatformOrganizersPage() {
  const actor = await getCurrentStaff();
  if (!actor) redirect("/office/login");
  if (actor.role !== "ADMIN") redirect("/office");
  const organizations = await db.organization.findMany({ include: { _count: { select: { users: true, events: true } } }, orderBy: { createdAt: "desc" } });
  return <AdminShell>
    <span className="eyebrow">Superuser</span><h1>Организаторы</h1>
    <p className="muted">Управление базовыми коммерческими условиями каждого организатора.</p>
    <div className="table-wrap"><table><thead><tr><th>Организатор</th><th>Пользователей</th><th>Мероприятий</th><th></th></tr></thead><tbody>{organizations.map((organization) => <tr key={organization.id}><td><strong>{organization.name}</strong><br/><small>{organization.id}</small></td><td>{organization._count.users}</td><td>{organization._count.events}</td><td><Link className="btn secondary" href={`/platform/organizers/${organization.id}`}>Открыть карточку</Link></td></tr>)}</tbody></table></div>
  </AdminShell>;
}
