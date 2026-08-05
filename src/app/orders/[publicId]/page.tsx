import QRCode from "qrcode";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, WalletCards, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { TicketCard } from "@/components/ticket-card";
import { DemoPaymentButton } from "@/components/demo-payment-button";
import { ResendTicketButton } from "@/components/resend-ticket-button";
import { CustomerRefundRequest } from "@/components/customer-refund-request";
import { parseTicketDesign } from "@/lib/ticket-template";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const order = await db.order.findUnique({
    where: { publicId },
    include: { event: { include: { venue: true, ticketTemplate: true } }, tickets: { include: { category: true } } },
  });
  if (!order) notFound();

  const qrs = await Promise.all(order.tickets.map((ticket) => QRCode.toDataURL(ticket.publicCode, { margin: 1, width: 360, errorCorrectionLevel: "M" })));
  const pending = order.status === "PENDING_APPROVAL";
  const rejected = order.status === "REJECTED";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paid = order.status === "PAID";
  const design = parseTicketDesign(order.event.ticketTemplate);
  const walletReady = Boolean(process.env.APPLE_WALLET_PASS_TYPE_ID && process.env.APPLE_WALLET_TEAM_ID && process.env.APPLE_WALLET_SIGNER_CERT_BASE64 && process.env.APPLE_WALLET_SIGNER_KEY_BASE64 && process.env.APPLE_WALLET_WWDR_CERT_BASE64);

  let refundRequest: { status: string; amountMinor: number; reason: string } | undefined;
  if (paid) {
    refundRequest = (await db.$queryRawUnsafe<Array<{ status: string; amountMinor: number; reason: string }>>(
      `SELECT "status","amountMinor","reason" FROM "RefundRequest" WHERE "orderId"=$1 ORDER BY "createdAt" DESC LIMIT 1`, order.id,
    ).catch(() => []))[0];
  }

  return <main className="shell"><section className="panel success">
    {pending && <Clock3 color="#d68b00" size={58} />}
    {rejected && <XCircle color="#b42318" size={58} />}
    {!pending && !rejected && <CheckCircle2 color="#0c9b66" size={58} />}
    <h1>{pending ? "Заявка отправлена" : rejected ? "Заявка отклонена" : awaitingPayment ? "Заявка одобрена" : "Спасибо! Заказ оформлен"}</h1>
    <p className="muted">
      {pending && "Организатор проверит данные. До одобрения оплата и выпуск билета недоступны."}
      {rejected && (order.reviewNote || "Организатор не подтвердил участие в мероприятии.")}
      {awaitingPayment && "Организатор подтвердил участие. Теперь можно завершить оплату и получить билет."}
      {paid && "Оплата подтверждена. Билеты отправлены на email и доступны ниже."}
    </p>
    {!paid && <div className="panel"><div className="row between"><span>Номер заказа</span><strong>{order.publicId}</strong></div><div className="row between"><span>Событие</span><strong>{order.event.title}</strong></div><div className="row between"><span>Статус</span><strong>{order.status}</strong></div></div>}
    {awaitingPayment && <div style={{ marginTop: 20 }}><DemoPaymentButton publicId={order.publicId} />{order.paymentDueAt && <p className="muted">Оплатить нужно до {order.paymentDueAt.toLocaleString("ru-RU")}</p>}</div>}
    {paid && walletReady && <section aria-label="Apple Wallet" style={{ marginTop: 22, padding: "20px 22px", borderRadius: 18, background: "linear-gradient(135deg,#060606 0%,#1f2937 100%)", color: "white", textAlign: "left", boxShadow: "0 14px 35px rgba(17,24,39,.18)" }}><div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}><span style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", flex: "0 0 auto" }}><WalletCards size={24} /></span><div><div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", color: "#d1d5db", textTransform: "uppercase" }}>Быстрый вход</div><h2 style={{ margin: "5px 0 7px", color: "white", fontSize: 22 }}>Добавьте билеты в Apple Wallet</h2><p style={{ margin: 0, color: "#d1d5db", lineHeight: 1.55, fontSize: 14 }}>Сохраните билет на iPhone, чтобы QR-код всегда был под рукой.</p></div></div></section>}
    {paid && <ResendTicketButton publicId={order.publicId} />}
    {paid && (refundRequest?.status === "PENDING" ? <div className="panel" style={{ marginTop: 20, textAlign: "left" }}><h2>Запрос на возврат рассматривается</h2><p>Сумма: {(refundRequest.amountMinor / 100).toFixed(2)} ₪</p><p className="muted">Причина: {refundRequest.reason}</p></div> : <CustomerRefundRequest publicId={order.publicId} totalMinor={order.totalMinor} customerEmail={order.customerEmail} />)}
    {order.tickets.map((ticket, index) => <TicketCard key={ticket.id} ticket={ticket} qr={qrs[index]} design={design} event={order.event} orderNumber={order.publicId} walletReady={walletReady} />)}
    <Link href="/" className="btn dark" style={{ marginTop: 20 }}>Вернуться к событиям</Link>
  </section></main>;
}
