import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";
import { localeTag, resolveStaffLocale } from "@/lib/i18n";

export const dynamic="force-dynamic";
const copy={ru:{eyebrow:"Журнал безопасности",title:"Журнал действий",description:"Кто, когда и что изменил в Atlas Office.",system:"Система",empty:"Журнал пока пуст",emptyText:"Здесь появятся одобрения, сканирования и изменения прав."},he:{eyebrow:"יומן אבטחה",title:"יומן פעילות",description:"מי שינה מה ומתי ב־Atlas Office.",system:"מערכת",empty:"היומן עדיין ריק",emptyText:"כאן יופיעו אישורים, סריקות ושינויים בהרשאות."},en:{eyebrow:"Security log",title:"Activity log",description:"Who changed what and when in Atlas Office.",system:"System",empty:"The log is empty",emptyText:"Approvals, scans and permission changes will appear here."}} as const;

export default async function AuditPage(){
  const staff=await requirePermission("TEAM_MANAGE");
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text=copy[locale];
  const logs=await db.auditLog.findMany({where:{organizationId:staff.organizationId!},include:{actor:true},orderBy:{createdAt:"desc"},take:100});
  const format=(date:Date)=>new Intl.DateTimeFormat(localeTag(locale),{dateStyle:"short",timeStyle:"short",timeZone:"Asia/Jerusalem"}).format(date);
  return <AdminShell><div className="office-page-heading"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.description}</p></div></div><div className="audit-list">{logs.map(log=><article key={log.id}><i>{log.actor?.name.split(" ").map(part=>part[0]).slice(0,2).join("")??"AT"}</i><div><strong>{log.summary}</strong><span>{log.actor?.name??text.system} · <bdi>{log.action}</bdi></span></div><time><bdi>{format(log.createdAt)}</bdi></time></article>)}{logs.length===0&&<div className="office-empty"><h3>{text.empty}</h3><p>{text.emptyText}</p></div>}</div></AdminShell>}
