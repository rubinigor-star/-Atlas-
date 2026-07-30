import Link from "next/link";
import { PlatformShell } from "@/components/platform-shell";
import { db } from "@/lib/db";
import { ensureDemoOrganizerPlatform } from "@/lib/auth";
import { money } from "@/lib/format";

export const dynamic="force-dynamic";

export default async function PlatformDashboard(){
  await ensureDemoOrganizerPlatform();
  const [organizations,events,users,revenue]=await Promise.all([
    db.organization.findMany({include:{users:true,events:true},orderBy:{createdAt:"asc"}}),
    db.event.count(),
    db.user.count({where:{role:"ORGANIZER"}}),
    db.order.aggregate({where:{status:"PAID"},_sum:{totalMinor:true}}),
  ]);
  return <PlatformShell>
    <div className="platform-heading"><div><span className="eyebrow">Atlas Platform Admin</span><h1>Управление платформой</h1><p>Организаторы, мероприятия, комиссии, договоры и общая финансовая картина.</p></div><span className="platform-admin-badge">SUPER ADMIN</span></div>
    <div className="stats"><div className="stat"><span className="muted">Организаторы</span><strong>{organizations.length}</strong></div><div className="stat"><span className="muted">Пользователи-организаторы</span><strong>{users}</strong></div><div className="stat"><span className="muted">Все мероприятия</span><strong>{events}</strong></div><div className="stat"><span className="muted">Продажи платформы</span><strong>{money(revenue._sum.totalMinor??0)}</strong></div></div>
    <div className="row between"><h2 className="section-title">Организаторы</h2><Link href="/platform/organizers">Открыть список →</Link></div>
    <div className="platform-card-grid">{organizations.map(org=><Link className="platform-organizer-card" href={`/platform/organizers/${org.id}`} key={org.id}><div><span className="eyebrow">Организатор</span><h3>{org.name}</h3></div><div className="platform-mini-stats"><span><b>{org.events.length}</b> мероприятий</span><span><b>{org.users.length}</b> пользователей</span></div><strong>Открыть карточку →</strong></Link>)}</div>
  </PlatformShell>;
}
