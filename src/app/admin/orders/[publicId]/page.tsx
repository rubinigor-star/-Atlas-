import Link from "next/link";
import { UserRound, UserRoundCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { eventDate, israelDateTime, money } from "@/lib/format";
import { AdminShell } from "@/components/admin-shell";
import { TicketActions } from "@/components/ticket-actions";
import { ApprovalActions } from "@/components/approval-actions";
import { ResendTicketButton } from "@/components/resend-ticket-button";
import { OrderRefundManager } from "@/components/order-refund-manager";
import { OrderCancelButton } from "@/components/order-cancel-button";
import { requireEventAccess } from "@/lib/auth";
import { ageAt, getOrderDemographics } from "@/lib/customer-demographics";
import { searchValueCardMember } from "@/lib/valuecard";
import { resolveStaffLocale } from "@/lib/i18n";

type AuthorizationRow={provider:string;providerReference:string;status:string;amountMinor:number;cardLast4:string|null;capturedAt:Date|null;voidedAt:Date|null;failureReason:string|null};
export const dynamic = "force-dynamic";

const copy={
  ru:{back:"← Вернуться",request:"Заявка на вход",order:"Заказ",amount:"Сумма",event:"Мероприятие",tickets:"Билеты",buyer:"Покупатель",orderData:"Данные заказа",created:"Создан",status:"Статус",answer:"Ответ клиента",composition:"Состав заказа",category:"Категория",quantity:"Количество",price:"Цена",payment:"Платёж",transaction:"Транзакция",card:"Карта",paid:"Оплачено",refund:"Возврат",reason:"Причина",noPayment:"Платёжная транзакция не найдена.",decision:"Решение организатора",comment:"Комментарий",sendTickets:"Отправка билетов",recipient:"Получатель",sendHelp:"Письмо будет отправлено повторно со всеми билетами заказа и PDF-вложением.",cancelOrder:"Отмена заказа",cancelHelp:"По этому заказу нет проведённого денежного списания. Отмена аннулирует билеты, освободит зарезервированные места и вернёт доступный остаток.",years:"лет",gender:{MALE:"Мужчина",FEMALE:"Женщина",UNKNOWN:"Не указан"}},
  he:{back:"← חזרה",request:"בקשת כניסה",order:"הזמנה",amount:"סכום",event:"אירוע",tickets:"כרטיסים",buyer:"רוכש",orderData:"פרטי ההזמנה",created:"נוצרה",status:"סטטוס",answer:"תשובת הלקוח",composition:"תכולת ההזמנה",category:"קטגוריה",quantity:"כמות",price:"מחיר",payment:"תשלום",transaction:"עסקה",card:"כרטיס",paid:"שולם",refund:"החזר",reason:"סיבה",noPayment:"לא נמצאה עסקת תשלום.",decision:"החלטת המפיק",comment:"הערה",sendTickets:"שליחת כרטיסים",recipient:"נמען",sendHelp:"המייל יישלח שוב עם כל כרטיסי ההזמנה וקובץ PDF מצורף.",cancelOrder:"ביטול הזמנה",cancelHelp:"בהזמנה הזו לא בוצע חיוב כספי. הביטול יבטל את הכרטיסים, ישחרר מקומות שמורים ויחזיר את המלאי הזמין.",years:"שנים",gender:{MALE:"גבר",FEMALE:"אישה",UNKNOWN:"לא צוין"}},
  en:{back:"← Back",request:"Entry request",order:"Order",amount:"Amount",event:"Event",tickets:"Tickets",buyer:"Buyer",orderData:"Order details",created:"Created",status:"Status",answer:"Customer response",composition:"Order contents",category:"Category",quantity:"Quantity",price:"Price",payment:"Payment",transaction:"Transaction",card:"Card",paid:"Paid",refund:"Refund",reason:"Reason",noPayment:"Payment transaction not found.",decision:"Organizer decision",comment:"Comment",sendTickets:"Send tickets",recipient:"Recipient",sendHelp:"The email will be resent with all order tickets and a PDF attachment.",cancelOrder:"Cancel order",cancelHelp:"No payment was captured for this order. Cancelling will invalidate tickets, release reserved seats and restore available inventory.",years:"years",gender:{MALE:"Male",FEMALE:"Female",UNKNOWN:"Not specified"}}
} as const;

function ValueCardBadge(){return <img src="/branding/valuecard-mark.svg" alt="ValueCard member" title="ValueCard member" style={{width:22,height:22,objectFit:"contain",display:"inline-block"}}/>;}

export default async function OrderAdmin({params,searchParams}:{params:Promise<{publicId:string}>;searchParams:Promise<{returnTo?:string}>}) {
  const {publicId}=await params;const query=await searchParams;const returnTo=query.returnTo?.startsWith("/office/")?query.returnTo:"/office/orders";
  const order=await db.order.findUnique({where:{publicId},include:{event:true,items:true,tickets:{include:{category:true}}}});if(!order)notFound();
  const staff=await requireEventAccess("ORDER_VIEW",order.eventId);
  const locale=resolveStaffLocale({memberOverride:staff.interfaceLocaleOverride,userPreference:staff.preferredLocale,organizationDefault:staff.organization?.defaultStaffLocale});
  const text=copy[locale];
  const genderLabel=(value:string|null)=>value==="MALE"?text.gender.MALE:value==="FEMALE"?text.gender.FEMALE:text.gender.UNKNOWN;
  const [authorization,demographics,valueCardMember]=await Promise.all([
    db.$queryRaw<AuthorizationRow[]>`SELECT provider,"providerReference",status,"amountMinor","cardLast4","capturedAt","voidedAt","failureReason" FROM "PaymentAuthorization" WHERE "orderId"=${order.id} LIMIT 1`.then(rows=>rows[0]),
    getOrderDemographics(order.id),
    searchValueCardMember(order.event.organizationId,order.customerPhone),
  ]);
  const canRefund=staff.permissionSet.has("ORDER_MANAGE");const refunded=authorization?.status==="REFUNDED"||authorization?.status==="PARTIALLY_REFUNDED"||order.status==="CANCELLED";const gender=demographics?.gender??null;const age=ageAt(demographics?.birthDate??order.customerBirthDate);
  const hasUsedTicket=order.tickets.some(ticket=>ticket.status==="USED");
  const canCancelWithoutRefund=canRefund&&!hasUsedTicket&&!['CANCELLED','REJECTED'].includes(order.status)&&(order.totalMinor===0||(!authorization?.capturedAt&&order.status!=="PAID"));
  return <AdminShell>
    <Link className="btn secondary" href={returnTo}>{text.back}</Link><span className="eyebrow">{order.status==="PENDING_APPROVAL"?text.request:text.order}</span>
    <div className="row between"><h1><bdi>{order.publicId}</bdi></h1><span className="pill"><bdi>{order.status}</bdi></span></div>
    <div className="stats"><div className="stat"><span className="muted">{text.amount}</span><strong><bdi>{money(order.totalMinor)}</bdi></strong></div><div className="stat"><span className="muted">{text.event}</span><strong>{order.event.title}</strong><small>{eventDate(order.event.startsAt)}</small></div><div className="stat"><span className="muted">{text.tickets}</span><strong>{order.tickets.length}</strong></div></div>
    <section className="panel form"><h2>{text.buyer}</h2><div className="form-grid two"><div><strong style={{display:"inline-flex",alignItems:"center",gap:6}}>{gender==="MALE"?<UserRound size={18}/>:gender==="FEMALE"?<UserRoundCheck size={18}/>:null}{order.customerName}{valueCardMember?<ValueCardBadge/>:null}</strong><p>{genderLabel(gender)}{age!==null?` · ${age} ${text.years}`:""}<br/><bdi>{order.customerEmail}</bdi><br/><bdi>{order.customerPhone}</bdi></p></div><div><strong>{text.orderData}</strong><p>{text.created}: {israelDateTime(order.createdAt)}<br/>{text.status}: <bdi>{order.status}</bdi></p></div></div></section>
    {order.eligibilityAnswer&&<div className="panel" style={{background:"#fff8e8"}}><strong>{text.answer}</strong><p>{order.eligibilityAnswer}</p></div>}
    <section className="panel"><h2>{text.composition}</h2><div className="table-wrap"><table><thead><tr><th>{text.category}</th><th>{text.quantity}</th><th>{text.price}</th></tr></thead><tbody>{order.items.map(item=><tr key={item.id}><td>{item.categoryName}</td><td>{item.quantity}</td><td><bdi>{money(item.unitPriceMinor*item.quantity)}</bdi></td></tr>)}</tbody></table></div></section>
    <section className="panel form"><h2>{text.payment}</h2>{authorization?<div className="form-grid two"><div><strong><bdi>{authorization.provider}</bdi></strong><p>{text.status}: <bdi>{authorization.status}</bdi><br/>{text.transaction}: <bdi>{authorization.providerReference}</bdi><br/>{text.card}: <bdi>{authorization.cardLast4?`•••• ${authorization.cardLast4}`:"—"}</bdi></p></div><div><strong><bdi>{money(authorization.amountMinor)}</bdi></strong><p>{authorization.capturedAt?`${text.paid}: ${israelDateTime(authorization.capturedAt)}`:""}{authorization.voidedAt?<><br/>{text.refund}: {israelDateTime(authorization.voidedAt)}</>:null}{authorization.failureReason?<><br/>{text.reason}: {authorization.failureReason}</>:null}</p></div></div>:<div className="toast">{text.noPayment}</div>}</section>
    {order.status==="PENDING_APPROVAL"&&staff.permissionSet.has("REQUEST_REVIEW")&&<><h2>{text.decision}</h2><ApprovalActions publicId={order.publicId} returnTo={returnTo}/></>}
    {order.reviewNote&&<div className="toast">{text.comment}: {order.reviewNote}</div>}
    {order.status==="PAID"&&order.tickets.length>0&&canRefund&&<div className="panel" style={{marginTop:20}}><h2 style={{marginTop:0}}>{text.sendTickets}</h2><p className="muted" style={{marginBottom:0}}>{text.recipient}: <strong><bdi>{order.customerEmail}</bdi></strong>. {text.sendHelp}</p><ResendTicketButton publicId={order.publicId}/></div>}
    {canCancelWithoutRefund&&<div className="panel" style={{marginTop:20}}><h2 style={{marginTop:0}}>{text.cancelOrder}</h2><p className="muted">{text.cancelHelp}</p><OrderCancelButton publicId={order.publicId}/></div>}
    {canRefund&&order.status==="PAID"&&authorization?.provider==="HYP"&&<OrderRefundManager orderId={order.publicId} totalMinor={order.totalMinor} alreadyRefunded={refunded}/>} 
    {order.tickets.length>0&&<h2>{text.tickets}</h2>}{order.tickets.map(ticket=><div className="panel row between" style={{marginBottom:12}} key={ticket.id}><div><span className="pill"><bdi>{ticket.status}</bdi></span><h3>{ticket.category.name}</h3><code dir="ltr">{ticket.publicCode}</code></div><div>{canRefund&&<TicketActions id={ticket.id} status={ticket.status}/>}<Link className="btn secondary" style={{marginTop:8}} href={`/api/tickets/${ticket.id}/pdf`}>PDF</Link></div></div>)}
  </AdminShell>;
}
