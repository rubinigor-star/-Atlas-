import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { listCancellationRequests } from "@/lib/cancellations";
import { money, eventDate, israelDateTime } from "@/lib/format";
import { resolveStaffLocale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const copy={
  ru:{eyebrow:"Центр отмен",title:"Отмены",description:"Реальные заявки клиентов на отмену заказов этой организации.",customer:"Клиентский экран",fresh:"Новые",freshHelp:"требуют решения",pending:"Ожидают возврата",pendingHelp:"после одобрения",refunded:"Возвращено",refundedHelp:"по завершённым заявкам",columns:["Заявка","Клиент","Мероприятие","Сумма","Проверка Atlas","Статус"],empty:"Заявок на отмену пока нет. Новая заявка клиента появится здесь автоматически.",legal:{STANDARD_ELIGIBLE:"Возврат предварительно положен",SPECIAL_REVIEW:"Нужна специальная проверка",OTHER:"Стандартное право не подтверждено"},status:{NEW:"Новая",REFUND_PENDING:"Возврат ожидает исполнения",REFUNDED:"Возвращено",APPROVED:"Одобрена",REJECTED:"Отклонена"}},
  he:{eyebrow:"מרכז ביטולים",title:"ביטולים",description:"בקשות אמיתיות של לקוחות לביטול הזמנות בארגון הזה.",customer:"מסך הלקוח",fresh:"חדשות",freshHelp:"ממתינות להחלטה",pending:"ממתינות להחזר",pendingHelp:"לאחר אישור",refunded:"הוחזר",refundedHelp:"בבקשות שהושלמו",columns:["בקשה","לקוח","אירוע","סכום","בדיקת Atlas","סטטוס"],empty:"עדיין אין בקשות ביטול. בקשה חדשה של לקוח תופיע כאן אוטומטית.",legal:{STANDARD_ELIGIBLE:"קיימת זכאות ראשונית להחזר",SPECIAL_REVIEW:"נדרשת בדיקה מיוחדת",OTHER:"הזכאות הרגילה לא אושרה"},status:{NEW:"חדשה",REFUND_PENDING:"ההחזר ממתין לביצוע",REFUNDED:"הוחזר",APPROVED:"אושרה",REJECTED:"נדחתה"}},
  en:{eyebrow:"Cancellation Center",title:"Cancellations",description:"Real customer requests to cancel orders for this organization.",customer:"Customer screen",fresh:"New",freshHelp:"need a decision",pending:"Awaiting refund",pendingHelp:"after approval",refunded:"Refunded",refundedHelp:"from completed requests",columns:["Request","Customer","Event","Amount","Atlas review","Status"],empty:"No cancellation requests yet. New customer requests will appear here automatically.",legal:{STANDARD_ELIGIBLE:"Preliminarily eligible for refund",SPECIAL_REVIEW:"Special review required",OTHER:"Standard eligibility not confirmed"},status:{NEW:"New",REFUND_PENDING:"Refund pending",REFUNDED:"Refunded",APPROVED:"Approved",REJECTED:"Rejected"}}
} as const;

export default async function CancellationsPage(){
  const staff=await requirePermission("ORDER_VIEW");
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text=copy[locale];
  const legalLabel=(value:string)=>value==="STANDARD_ELIGIBLE"?text.legal.STANDARD_ELIGIBLE:value==="SPECIAL_REVIEW"?text.legal.SPECIAL_REVIEW:text.legal.OTHER;
  const statusLabel=(value:string)=>text.status[value as keyof typeof text.status]??value;
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const rows=await listCancellationRequests(staff.organizationId!,eventIds.length?eventIds:undefined);
  const fresh=rows.filter(row=>row.status==="NEW").length;
  const pending=rows.filter(row=>row.status==="REFUND_PENDING").length;
  const refunded=rows.filter(row=>row.status==="REFUNDED").reduce((sum,row)=>sum+(row.orderAmountMinor-row.statutoryFeeMinor),0);
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">{text.eyebrow}</span><h1>{text.title}</h1><p>{text.description}</p></div><Link className="btn secondary" href="/cancel-order" target="_blank">{text.customer}</Link></div>
    <div className="stats"><div className="stat"><span className="muted">{text.fresh}</span><strong>{fresh}</strong><small>{text.freshHelp}</small></div><div className="stat"><span className="muted">{text.pending}</span><strong>{pending}</strong><small>{text.pendingHelp}</small></div><div className="stat"><span className="muted">{text.refunded}</span><strong><bdi>{money(refunded)}</bdi></strong><small>{text.refundedHelp}</small></div></div>
    <div className="table-wrap"><table><thead><tr>{text.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>
      {rows.map(row=><tr key={row.id}><td><Link href={`/office/cancellations/${row.id}`}><strong><bdi>{row.publicId}</bdi></strong></Link><br/><small><bdi>{row.orderPublicId}</bdi></small></td><td><strong>{row.customerName}</strong><br/><small><bdi>{row.customerEmail}</bdi><br/>{israelDateTime(row.createdAt)}</small></td><td><strong>{row.eventTitle}</strong><br/><small>{eventDate(row.eventStartsAt)}</small></td><td><strong><bdi>{money(row.orderAmountMinor)}</bdi></strong></td><td><span style={{fontWeight:700,color:row.legalStatus==="STANDARD_ELIGIBLE"?"#15803d":row.legalStatus==="SPECIAL_REVIEW"?"#a16207":"#b45309"}}>{legalLabel(row.legalStatus)}</span></td><td><span className="pill">{statusLabel(row.status)}</span></td></tr>)}
      {!rows.length&&<tr><td colSpan={6}>{text.empty}</td></tr>}
    </tbody></table></div>
  </AdminShell>;
}
