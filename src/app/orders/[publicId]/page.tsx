import QRCode from "qrcode";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, WalletCards, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { TicketCard } from "@/components/ticket-card";
import { DemoPaymentButton } from "@/components/demo-payment-button";
import { OrderCartCleanup } from "@/components/order-cart-cleanup";
import { parseTicketDesign } from "@/lib/ticket-template";
import styles from "./order-status.module.css";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
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

  return (
    <main className={styles.page}>
      {shouldClearCart && <OrderCartCleanup eventSlug={order.event.slug} eventTitle={order.event.title} />}
      <div className={styles.stack}>
        <section className={styles.statusCard}>
          <div className={`${styles.iconWrap} ${iconClass}`}>
            {pending && <Clock3 size={34} strokeWidth={2.2} />}
            {(rejected || cancelled) && <XCircle size={34} strokeWidth={2.2} />}
            {!pending && !rejected && !cancelled && <CheckCircle2 size={34} strokeWidth={2.2} />}
          </div>

          <h1 className={styles.title}>{pending ? "Заявка отправлена" : rejected ? "Заявка отклонена" : cancelled ? "Заказ отменён" : awaitingPayment ? "Заявка одобрена" : "Спасибо! Заказ оформлен"}</h1>
          <p className={styles.message}>
            {pending && "Заявка передана организатору. Сумма предварительно авторизована на карте, но деньги ещё не списаны. Списание произойдёт только после подтверждения организатором."}
            {rejected && (order.reviewNote || "Организатор не подтвердил участие в мероприятии.")}
            {cancelled && `Организатор отменил заказ${refundedMinor>0?` и оформил возврат ${(refundedMinor/100).toFixed(2)} ₪`:""}. Все билеты и QR-коды по этому заказу недействительны.`}
            {awaitingPayment && "Организатор подтвердил участие. Теперь можно завершить оплату и получить билет."}
            {paid && "Оплата подтверждена. Билеты отправлены на email и доступны ниже."}
          </p>

          {!paid && <div className={styles.detailsCard}>
            <div className={styles.detailRow}><span className={styles.detailLabel}>Номер заказа</span><strong className={`${styles.detailValue} ${styles.statusCode}`}>{order.publicId}</strong></div>
            <div className={styles.detailRow}><span className={styles.detailLabel}>Событие</span><strong className={styles.detailValue}>{order.event.title}</strong></div>
            {cancelled && <div className={styles.detailRow}><span className={styles.detailLabel}>Статус</span><strong className={`${styles.detailValue} ${styles.dangerText}`}>Отменён</strong></div>}
            {cancelled && refundedMinor>0 && <div className={styles.detailRow}><span className={styles.detailLabel}>Возврат оформлен</span><strong className={styles.detailValue}>{(refundedMinor/100).toFixed(2)} ₪</strong></div>}
            {!cancelled && <div className={styles.detailRow}><span className={styles.detailLabel}>Статус</span><strong className={styles.detailValue}>{order.status}</strong></div>}
          </div>}

          {cancelled && <section className={styles.noticeCard}><h2>Билеты больше не действуют</h2><p>Не используйте QR-коды из предыдущего письма или Apple Wallet. Если возврат уже оформлен, срок зачисления средств зависит от вашего банка и платёжной системы.</p></section>}

          {awaitingPayment && <div className={styles.paymentBlock}><DemoPaymentButton publicId={order.publicId} />{order.paymentDueAt && <p className={styles.paymentDue}>Оплатить нужно до {order.paymentDueAt.toLocaleString("ru-RU")}</p>}</div>}

          {paid && walletReady && <section aria-label="Apple Wallet" className={styles.walletCard}><span className={styles.walletIcon}><WalletCards size={24} /></span><div className={styles.walletEyebrow}>Быстрый вход</div><h2>Добавьте билеты в Apple Wallet</h2><p>Сохраните билет на iPhone, чтобы QR-код всегда был под рукой.</p></section>}

          {paid && <section className={styles.cancelCard}><span className={styles.eyebrow}>Отмена и возврат</span><h2>Нужно отменить заказ?</h2><p>Сначала ознакомьтесь с политикой отмены Atlas One и правилами Закона о защите прав потребителей. После этого можно подать заявку организатору.</p><Link href={cancellationPolicyUrl} className={styles.secondaryButton}>Правила отмены и подача заявки</Link></section>}

          <Link href="/" className={styles.primaryButton}>Вернуться к событиям</Link>
        </section>

        {!cancelled && order.tickets.length > 0 && <div className={styles.ticketList}>{order.tickets.map((ticket, index) => <TicketCard key={ticket.id} ticket={ticket} qr={qrs[index]} design={design} event={order.event} orderNumber={order.publicId} walletReady={walletReady} />)}</div>}
      </div>
    </main>
  );
}
