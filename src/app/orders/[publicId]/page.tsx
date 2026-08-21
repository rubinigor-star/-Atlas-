import QRCode from "qrcode";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, WalletCards, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { TicketCard } from "@/components/ticket-card";
import { DemoPaymentButton } from "@/components/demo-payment-button";
import { OrderCartCleanup } from "@/components/order-cart-cleanup";
import { parseTicketDesign } from "@/lib/ticket-template";

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

  return (
    <main className="shell">
      {shouldClearCart && <OrderCartCleanup eventSlug={order.event.slug} eventTitle={order.event.title} />}
      <section className="panel success">
        {pending && <Clock3 color="#d68b00" size={58} />}
        {(rejected || cancelled) && <XCircle color="#b42318" size={58} />}
        {!pending && !rejected && !cancelled && <CheckCircle2 color="#0c9b66" size={58} />}

        <h1>{pending ? "Заявка отправлена" : rejected ? "Заявка отклонена" : cancelled ? "Заказ отменён" : awaitingPayment ? "Заявка одобрена" : "Спасибо! Заказ оформлен"}</h1>
        <p className="muted">
          {pending && "Заявка передана организатору. Сумма предварительно авторизована на карте, но деньги ещё не списаны. Списание произойдёт только после подтверждения организатором."}
          {rejected && (order.reviewNote || "Организатор не подтвердил участие в мероприятии.")}
          {cancelled && `Организатор отменил заказ${refundedMinor>0?` и оформил возврат ${(refundedMinor/100).toFixed(2)} ₪`:""}. Все билеты и QR-коды по этому заказу недействительны.`}
          {awaitingPayment && "Организатор подтвердил участие. Теперь можно завершить оплату и получить билет."}
          {paid && "Оплата подтверждена. Билеты отправлены на email и доступны ниже."}
        </p>

        {!paid && <div className="panel"><div className="row between"><span>Номер заказа</span><strong>{order.publicId}</strong></div><div className="row between"><span>Событие</span><strong>{order.event.title}</strong></div>{cancelled&&<div className="row between"><span>Статус</span><strong style={{color:"#b42318"}}>Отменён</strong></div>}{cancelled&&refundedMinor>0&&<div className="row between"><span>Возврат оформлен</span><strong>{(refundedMinor/100).toFixed(2)} ₪</strong></div>}{!cancelled&&<div className="row between"><span>Статус</span><strong>{order.status}</strong></div>}</div>}

        {cancelled && <section className="panel" style={{marginTop:20,textAlign:"left",background:"#fff7ed",borderColor:"#fed7aa"}}><h2 style={{margin:"0 0 8px"}}>Билеты больше не действуют</h2><p className="muted" style={{margin:0}}>Не используйте QR-коды из предыдущего письма или Apple Wallet. Если возврат уже оформлен, срок зачисления средств зависит от вашего банка и платёжной системы.</p></section>}

        {awaitingPayment && <div style={{ marginTop: 20 }}><DemoPaymentButton publicId={order.publicId} />{order.paymentDueAt && <p className="muted">Оплатить нужно до {order.paymentDueAt.toLocaleString("ru-RU")}</p>}</div>}

        {paid && walletReady && <section aria-label="Apple Wallet" style={{ marginTop: 22, padding: "20px 22px", borderRadius: 18, background: "linear-gradient(135deg,#060606 0%,#1f2937 100%)", color: "white", textAlign: "left", boxShadow: "0 14px 35px rgba(17,24,39,.18)" }}><div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}><span style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><WalletCards size={24} /></span><div><div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", color: "#d1d5db", textTransform: "uppercase" }}>Быстрый вход</div><h2 style={{ margin: "5px 0 7px", color: "white", fontSize: 22 }}>Добавьте билеты в Apple Wallet</h2><p style={{ margin: 0, color: "#d1d5db", lineHeight: 1.55, fontSize: 14 }}>Сохраните билет на iPhone, чтобы QR-код всегда был под рукой.</p></div></div></section>}

        {!cancelled && order.tickets.map((ticket, index) => <TicketCard key={ticket.id} ticket={ticket} qr={qrs[index]} design={design} event={order.event} orderNumber={order.publicId} walletReady={walletReady} />)}

        {paid && <section className="panel" style={{marginTop:22,textAlign:"left",background:"#f8fafc"}}><span className="eyebrow">Отмена и возврат</span><h2 style={{margin:"6px 0 8px"}}>Нужно отменить заказ?</h2><p className="muted" style={{margin:"0 0 16px"}}>Сначала ознакомьтесь с политикой отмены Atlas One и правилами Закона о защите прав потребителей. После этого можно подать заявку организатору.</p><Link href={cancellationPolicyUrl} className="btn secondary">Правила отмены и подача заявки</Link></section>}

        <Link href="/" className="btn dark" style={{ marginTop: 20 }}>Вернуться к событиям</Link>
      </section>
    </main>
  );
}
