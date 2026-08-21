import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { CheckCircle2, Clock3, WalletCards, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { TicketCard } from "@/components/ticket-card";
import { DemoPaymentButton } from "@/components/demo-payment-button";
import { OrderCartCleanup } from "@/components/order-cart-cleanup";
import { OrderFrameEscape } from "@/components/order-frame-escape";
import { parseTicketDesign } from "@/lib/ticket-template";
import { normalizeLocale } from "@/lib/i18n";
import styles from "./order-status.module.css";

export const dynamic = "force-dynamic";

const copy={
  ru:{submitted:"Заявка отправлена",rejected:"Заявка отклонена",cancelled:"Заказ отменён",approved:"Заявка одобрена",paid:"Спасибо! Заказ оформлен",pendingBody:"Заявка передана организатору на рассмотрение. Сумма временно авторизована на карте: кредитный лимит зарезервирован, но деньги не списываются до подтверждения организатором. После подтверждения билет будет отправлен вам на email.",rejectedBody:"Организатор не подтвердил участие в мероприятии.",approvedBody:"Организатор подтвердил участие. Теперь можно завершить оплату и получить билет.",paidBody:"Оплата подтверждена. Билеты отправлены на email и доступны ниже.",order:"Номер заказа",event:"Событие",status:"Статус",pendingStatus:"Ожидает подтверждения",rejectedStatus:"Отклонена",cancelledStatus:"Отменён",back:"Вернуться к событиям",refund:"Возврат оформлен",invalidTitle:"Билеты больше не действуют",invalidBody:"Не используйте QR-коды из предыдущего письма или Apple Wallet. Если возврат уже оформлен, срок зачисления средств зависит от вашего банка и платёжной системы."},
  he:{submitted:"הבקשה נשלחה",rejected:"הבקשה נדחתה",cancelled:"ההזמנה בוטלה",approved:"הבקשה אושרה",paid:"תודה! ההזמנה הושלמה",pendingBody:"הבקשה הועברה למארגן לבדיקה. מסגרת כרטיס האשראי נתפסת זמנית, אך הסכום לא יורד ולא מחויב עד לאישור של המפיק. לאחר האישור הכרטיס יישלח אליך בדוא״ל.",rejectedBody:"המארגן לא אישר את ההשתתפות באירוע.",approvedBody:"המארגן אישר את ההשתתפות. כעת ניתן להשלים את התשלום ולקבל את הכרטיס.",paidBody:"התשלום אושר. הכרטיסים נשלחו בדוא״ל וזמינים גם למטה.",order:"מספר הזמנה",event:"אירוע",status:"סטטוס",pendingStatus:"ממתין לאישור",rejectedStatus:"נדחתה",cancelledStatus:"בוטלה",back:"חזרה לאירועים",refund:"החזר בוצע",invalidTitle:"הכרטיסים אינם תקפים יותר",invalidBody:"אין להשתמש בקודי QR מהודעה קודמת או מ-Apple Wallet. אם בוצע החזר, מועד הזיכוי תלוי בבנק ובחברת האשראי."},
  en:{submitted:"Request submitted",rejected:"Request rejected",cancelled:"Order cancelled",approved:"Request approved",paid:"Thank you! Order completed",pendingBody:"Your request has been sent to the organizer for review. The amount is temporarily authorized on your card: your credit limit is reserved, but you are not charged until the organizer approves the request. After approval, your ticket will be sent to you by email.",rejectedBody:"The organizer did not approve your participation in the event.",approvedBody:"The organizer approved your participation. You can now complete payment and receive your ticket.",paidBody:"Payment confirmed. Your tickets were sent by email and are also available below.",order:"Order number",event:"Event",status:"Status",pendingStatus:"Pending approval",rejectedStatus:"Rejected",cancelledStatus:"Cancelled",back:"Back to events",refund:"Refund issued",invalidTitle:"Tickets are no longer valid",invalidBody:"Do not use QR codes from a previous email or Apple Wallet. If a refund was issued, posting time depends on your bank and card network."}
} as const;

export default async function OrderPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const store=await cookies();
  const locale=normalizeLocale(store.get("atlas-locale")?.value||"ru");
  const text=copy[locale];
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { include: { venue: true, ticketTemplate: true } }, tickets: { include: { category: true } } } });
  if (!order) notFound();

  const pending = order.status === "PENDING_APPROVAL";
  const rejected = order.status === "REJECTED";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paid = order.status === "PAID";
  const cancelled = order.status === "CANCELLED";
  const shouldClearCart = pending || rejected || awaitingPayment || paid || cancelled;
  const qrs = cancelled ? [] : await Promise.all(order.tickets.map((ticket) => QRCode.toDataURL(ticket.publicCode, { margin: 1, width: 360, errorCorrectionLevel: "M" })));
  const design = parseTicketDesign(order.event.ticketTemplate);
  const walletReady = Boolean(process.env.APPLE_WALLET_PASS_TYPE_ID && process.env.APPLE_WALLET_TEAM_ID && process.env.APPLE_WALLET_SIGNER_CERT_BASE64 && process.env.APPLE_WALLET_SIGNER_KEY_BASE64 && process.env.APPLE_WALLET_WWDR_CERT_BASE64);
  const cancellationParams = new URLSearchParams({ order: order.publicId, email: order.customerEmail });
  const cancellationPolicyUrl = `/cancellation-policy?${cancellationParams.toString()}`;
  const refundRow = cancelled ? (await db.$queryRawUnsafe<Array<{ refundedMinor:number }>>(`SELECT "refundedMinor" FROM "PaymentAuthorization" WHERE "orderId"=$1 LIMIT 1`,order.id))[0] : null;
  const refundedMinor = refundRow?.refundedMinor || 0;
  const iconClass = rejected || cancelled ? styles.iconRejected : pending ? styles.iconPending : styles.iconSuccess;
  const title=pending?text.submitted:rejected?text.rejected:cancelled?text.cancelled:awaitingPayment?text.approved:text.paid;
  const body=pending?text.pendingBody:rejected?(order.reviewNote||text.rejectedBody):cancelled?(locale==="he"?`המארגן ביטל את ההזמנה${refundedMinor>0?` ובוצע החזר של ${(refundedMinor/100).toFixed(2)} ₪`:""}. כל הכרטיסים וקודי ה-QR בהזמנה זו אינם תקפים.`:locale==="en"?`The organizer cancelled the order${refundedMinor>0?` and issued a refund of ${(refundedMinor/100).toFixed(2)} ₪`:""}. All tickets and QR codes for this order are invalid.`:`Организатор отменил заказ${refundedMinor>0?` и оформил возврат ${(refundedMinor/100).toFixed(2)} ₪`:""}. Все билеты и QR-коды по этому заказу недействительны.`):awaitingPayment?text.approvedBody:paid?text.paidBody:"";
  const statusLabel=pending?text.pendingStatus:rejected?text.rejectedStatus:cancelled?text.cancelledStatus:order.status;

  return (
    <main className={styles.page} dir={locale==="he"?"rtl":"ltr"}>
      <OrderFrameEscape />
      {shouldClearCart && <OrderCartCleanup eventSlug={order.event.slug} eventTitle={order.event.title} />}
      <div className={styles.stack}>
        <section className={styles.statusCard}>
          <div className={`${styles.iconWrap} ${iconClass}`}>
            {pending && <Clock3 size={34} strokeWidth={2.2} />}
            {(rejected || cancelled) && <XCircle size={34} strokeWidth={2.2} />}
            {!pending && !rejected && !cancelled && <CheckCircle2 size={34} strokeWidth={2.2} />}
          </div>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.message}>{body}</p>
          {!paid && <div className={styles.detailsCard}>
            <div className={styles.detailRow}><span className={styles.detailLabel}>{text.order}</span><strong className={`${styles.detailValue} ${styles.statusCode}`}>{order.publicId}</strong></div>
            <div className={styles.detailRow}><span className={styles.detailLabel}>{text.event}</span><strong className={styles.detailValue}>{order.event.title}</strong></div>
            <div className={styles.detailRow}><span className={styles.detailLabel}>{text.status}</span><strong className={`${styles.detailValue} ${(rejected||cancelled)?styles.dangerText:""}`}>{statusLabel}</strong></div>
            {cancelled && refundedMinor>0 && <div className={styles.detailRow}><span className={styles.detailLabel}>{text.refund}</span><strong className={styles.detailValue}>{(refundedMinor/100).toFixed(2)} ₪</strong></div>}
          </div>}
          {cancelled && <section className={styles.noticeCard}><h2>{text.invalidTitle}</h2><p>{text.invalidBody}</p></section>}
          {awaitingPayment && <div className={styles.paymentBlock}><DemoPaymentButton publicId={order.publicId} />{order.paymentDueAt && <p className={styles.paymentDue}>{order.paymentDueAt.toLocaleString(locale==="he"?"he-IL":locale==="en"?"en-US":"ru-RU")}</p>}</div>}
          {paid && walletReady && <section aria-label="Apple Wallet" className={styles.walletCard}><span className={styles.walletIcon}><WalletCards size={24} /></span><div className={styles.walletEyebrow}>Apple Wallet</div><h2>Apple Wallet</h2></section>}
          {paid && <section className={styles.cancelCard}><Link href={cancellationPolicyUrl} className={styles.secondaryButton}>{locale==="he"?"מדיניות ביטול ובקשה":locale==="en"?"Cancellation policy and request":"Правила отмены и подача заявки"}</Link></section>}
          <Link href="/" className={styles.primaryButton}>{text.back}</Link>
        </section>
        {!cancelled && order.tickets.length > 0 && <div className={styles.ticketList}>{order.tickets.map((ticket, index) => <TicketCard key={ticket.id} ticket={ticket} qr={qrs[index]} design={design} event={order.event} orderNumber={order.publicId} walletReady={walletReady} />)}</div>}
      </div>
    </main>
  );
}
