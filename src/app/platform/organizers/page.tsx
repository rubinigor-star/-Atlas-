import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";
import { ensureDemoOrganizerPlatform } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic="force-dynamic";

export default async function PlatformOrganizersPage(){
  await ensureDemoOrganizerPlatform();
  const organizations=await db.organization.findMany({include:{users:true,events:true},orderBy:{createdAt:"asc"}});
  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Atlas Platform Admin</span><h1>Организаторы</h1><p>Управление компаниями, владельцами кабинетов, мероприятиями и базовыми коммерческими условиями.</p></div></div>
    <div className="table-wrap"><table><thead><tr><th>Организация</th><th>Владелец кабинета</th><th>Мероприятия</th><th>Пользователи</th><th></th></tr></thead><tbody>{organizations.map(org=>{const owner=org.users.find(user=>user.staffRole==="OWNER")??org.users[0];return <tr key={org.id}><td><strong>{org.name}</strong><br/><small>{org.id}</small></td><td>{owner?.name??"Не назначен"}<br/><small>{owner?.email??""}</small></td><td>{org.events.length}</td><td>{org.users.length}</td><td><Link className="btn" href={`/platform/organizers/${org.id}`}>Открыть карточку</Link></td></tr>})}</tbody></table></div>
  </PlatformShell>;
}
