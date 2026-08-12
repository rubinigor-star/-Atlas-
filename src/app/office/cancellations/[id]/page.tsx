import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { requirePermission } from "@/lib/auth";
import { CancellationReviewPrototype } from "@/components/cancellation-review-prototype";
import { getCancellationRequest } from "@/lib/cancellations";
import { money, eventDate, israelDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function legalTitle(value:string){return value==="STANDARD_ELIGIBLE"?"Возврат предварительно положен по стандартной политике":value==="SPECIAL_REVIEW"?"Требуется специальная проверка":"Стандартное право на возврат автоматически не подтверждено";}

export default async function CancellationDetail({params}:{params:Promise<{id:string}>}){
  const staff=await requirePermission("ORDER_VIEW");
  const {id}=await params;
  const eventIds=staff.eventAccess.map(item=>item.eventId);
  const row=await getCancellationRequest(id,staff.organizationId!,eventIds.length?eventIds:undefined);
  if(!row)notFound();
  return <AdminShell>
    <div className="office-page-heading"><div><span className="eyebrow">Cancellation request</span><h1>{row.publicId}</h1><p>Проверка реальной заявки клиента и выбор суммы возврата.</p></div><Link className="btn secondary" href="/office/cancellations">Назад к отменам</Link></div>
    <div className="form-grid two" style={{alignItems:"start"}}>
      <div className="stack">
        <section className="panel stack"><div><span className="eyebrow">Клиент и заказ</span><h2>{row.customerName}</h2></div><div className="row between"><span className="muted">Номер заказа</span><strong>{row.orderPublicId}</strong></div><div className="row between"><span className="muted">Email</span><strong>{row.customerEmail}</strong></div><div className="row between"><span className="muted">Телефон</span><strong>{row.customerPhone}</strong></div><div className="row between"><span className="muted">Дата покупки</span><strong>{israelDateTime(row.orderCreatedAt)}</strong></div><div className="row between"><span className="muted">Заявка на отмену</span><strong>{israelDateTime(row.createdAt)}</strong></div>{row.reason&&<div><span className="muted">Причина клиента</span><p style={{marginBottom:0}}>{row.reason}</p></div>}</section>
        <section className="panel stack"><div><span className="eyebrow">Мероприятие</span><h2>{row.eventTitle}</h2></div><div className="row between"><span className="muted">Дата</span><strong>{eventDate(row.eventStartsAt)}</strong></div><div className="row between"><span className="muted">Билеты</span><strong>{row.itemSummary||"Билеты заказа"}</strong></div><div className="row between"><span className="muted">Сумма заказа</span><strong>{money(row.orderAmountMinor)}</strong></div>{row.specialCategory&&<div className="row between"><span className="muted">Льготная категория</span><strong>{row.specialCategory}</strong></div>}</section>
        <section className="panel" style={{background:row.legalStatus==="STANDARD_ELIGIBLE"?"#f0fdf4":row.legalStatus==="SPECIAL_REVIEW"?"#fffbeb":"#fff7ed",borderColor:row.legalStatus==="STANDARD_ELIGIBLE"?"#bbf7d0":row.legalStatus==="SPECIAL_REVIEW"?"#fde68a":"#fed7aa"}}><span className="eyebrow">Проверка Atlas</span><h3 style={{marginTop:6}}>{legalTitle(row.legalStatus)}</h3><p className="muted" style={{marginBottom:0}}>{row.legalReason}</p></section>
        {row.reviewedAt&&<section className="panel stack"><span className="eyebrow">Принятое решение</span><div className="row between"><span className="muted">Статус</span><strong>{row.status}</strong></div>{row.refundAmountMinor!==null&&<div className="row between"><span className="muted">Сумма возврата</span><strong>{money(row.refundAmountMinor)}</strong></div>}{row.organizerChargeMinor!==null&&<div className="row between"><span className="muted">За счёт организатора</span><strong>{money(row.organizerChargeMinor)}</strong></div>}{row.decisionNote&&<p>{row.decisionNote}</p>}</section>}
      </div>
      <CancellationReviewPrototype id={row.id} orderAmountMinor={row.orderAmountMinor} statutoryFeeMinor={row.statutoryFeeMinor} status={row.status}/>
    </div>
  </AdminShell>;
}
