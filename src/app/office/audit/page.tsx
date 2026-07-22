import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";

export const dynamic="force-dynamic";
export default async function AuditPage(){const staff=await requirePermission("TEAM_MANAGE");const logs=await db.auditLog.findMany({where:{organizationId:staff.organizationId!},include:{actor:true},orderBy:{createdAt:"desc"},take:100});return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">Security log</span><h1>Журнал действий</h1><p>Кто, когда и что изменил в Atlas Office.</p></div></div><div className="audit-list">{logs.map(log=><article key={log.id}><i>{log.actor?.name.split(" ").map(part=>part[0]).slice(0,2).join("")??"AT"}</i><div><strong>{log.summary}</strong><span>{log.actor?.name??"Система"} · {log.action}</span></div><time>{log.createdAt.toLocaleString("ru-RU")}</time></article>)}{logs.length===0&&<div className="office-empty"><h3>Журнал пока пуст</h3><p>Здесь появятся одобрения, сканирования и изменения прав.</p></div>}</div></AdminShell>}
