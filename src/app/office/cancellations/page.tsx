import Link from "next/link";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { listCancellationRequests } from "@/lib/cancellations";
import { money, eventDate, israelDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function legalLabel(value:string){return value==="STANDARD_ELIGIBLE"?"Возврат предварительно положен":value==="SPECIAL_REVIEW"?"Нужна специальная проверка":"Стандартное право не подтверждено";}
function statusLabel(value:string){return value==="NEW"?"Новая":value==="REFUND_PENDING"?"Возврат ожидает исполнения":value==="REFUNDED"?"Возвращено":value==="APPROVED"?"Одобрена":value==="REJECTED"?"Отклонена":value;}

export default async function CancellationsPage(){
  const staff=await requirePermission("ORDER_VIEW");
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const rows=await listCancellationRequests(staff.organizationId!,eventIds.length?eventIds:undefined);
  const fresh=rows.filter(row=>row.status==="NEW").length;
  const pending=rows.filter(row=>row.status==="REFUND_PENDING").length;
  const refunded=rows.filter(row=>row.status==="REFUNDED").reduce((sum,row)=>sum+(row.orderAmountMinor-row.statutoryFeeMinor),0);
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Cancellation Center</span><h1>Отмены</h1><p>Реальные заявки клиентов на отмену заказов этой организации.</p></div><Link className="btn secondary" href="/cancel-order" target="_blank">Клиентский экран</Link></div>
    <div className="stats"><div className="stat"><span className="muted">Новые</span><strong>{fresh}</strong><small>требуют решения</small></div><div className="stat"><span className="muted">Ожидают возврата</span><strong>{pending}</strong><small>после одобрения</small></div><div className="stat"><span className="muted">Возвращено</span><strong>{money(refunded)}</strong><small>по завершённым заявкам</small></div></div>
    <div className="table-wrap"><table><thead><tr><th>Заявка</th><th>Клиент</th><th>Мероприятие</th><th>Сумма</th><th>Проверка Atlas</th><th>Статус</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.id}><td><Link href={`/office/cancellations/${row.id}`}><strong>{row.publicId}</strong></Link><br/><small>{row.orderPublicId}</small></td><td><strong>{row.customerName}</strong><br/><small>{row.customerEmail}<br/>{israelDateTime(row.createdAt)}</small></td><td><strong>{row.eventTitle}</strong><br/><small>{eventDate(row.eventStartsAt)}</small></td><td><strong>{money(row.orderAmountMinor)}</strong></td><td><span style={{fontWeight:700,color:row.legalStatus==="STANDARD_ELIGIBLE"?"#15803d":row.legalStatus==="SPECIAL_REVIEW"?"#a16207":"#b45309"}}>{legalLabel(row.legalStatus)}</span></td><td><span className="pill">{statusLabel(row.status)}</span></td></tr>)}
      {!rows.length&&<tr><td colSpan={6}>Заявок на отмену пока нет. Новая заявка клиента появится здесь автоматически.</td></tr>}
    </tbody></table></div>
  </AdminShell>;
}
