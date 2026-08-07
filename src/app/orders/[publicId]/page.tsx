import QRCode from "qrcode";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, WalletCards, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { TicketCard } from "@/components/ticket-card";
import { DemoPaymentButton } from "@/components/demo-payment-button";
import { ResendTicketButton } from "@/components/resend-ticket-button";
import { parseTicketDesign } from "@/lib/ticket-template";

export const dynamic = "force-dynamic";

export default async function OrderPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = await params;
  const order = await db.order.findUnique({
    where: { publicId },
    include: {
      event: { include: { venue: true, ticketTemplate: true } },
      tickets: { include: { category: true } },
    },
  });
  if (!order) notFound();

  const qrs = await Promise.all(
    order.tickets.map((ticket) =>
      QRCode.toDataURL(ticket.publicCode, { margin: 1, width: 360, errorCorrectionLevel: "M" }),
    ),
  );
  const pendingPayment = order.status === "PENDING";
  const pendingApproval = order.status === "PENDING_APPROVAL";
  const rejected = order.status === "REJECTED";
  const cancelled = order.status === "CANCELLED";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const paid = order.status === "PAID";
  const design = parseTicketDesign(order.event.ticketTemplate);
  const walletReady = Boolean(
    process.env.APPLE_WALLET_PASS_TYPE_ID &&
    process.env.APPLE_WALLET_TEAM_ID &&
    process.env.APPLE_WALLET_SIGNER_CERT_BASE64 &&
    process.env.APPLE_WALLET_SIGNER_KEY_BASE64 &&
    process.env.APPLE_WALLET_WWDR_CERT_BASE64,
  );

  const isFailure = rejected || cancelled;
  const isWaiting = pendingPayment || pendingApproval || awaitingPayment;
  const title = paid
    ? "Спасибо! Заказ оформлен"
    : pendingApproval
      ? "Заявка отправлена организатору"
      : pendingPayment
        ? "Ожидаем подтверждение оплаты"
        : awaitingPayment
          ? "Заявка одобрена"
          : rejected
            ? "Заявка отклонена"
            : cancelled
              ? "Оплата не завершена"
              : "Статус заказа обновлён";

  return (
    <main className="shell">
      <section className="panel success">
        {paid && <CheckCircle2 color="#0c9b66" size={58} />}
        {isWaiting && <Clock3 color="#d68b00" size={58} />}
        {isFailure && <XCircle color="#b42318" size={58} />}

        <h1>{title}</h1>
        <p className="muted">
          {pendingPayment && "Платёж ещё не подтверждён. Билет не выпущен, и заказ нельзя считать оплаченным."}
          {pendingApproval && "Данные и предварительная авторизация карты получены. Деньги будут списаны только после подтверждения организатором."}
          {rejected && (order.reviewNote || "Организатор не подтвердил участие. Деньги не должны быть списаны.")}
          {cancelled && "Платёж или предварительная авторизация не были успешно завершены. Билет не выпущен."}
          {awaitingPayment && "Организатор подтвердил участие. Теперь можно завершить оплату и получить билет."}
          {paid && "Оплата подтверждена. Билеты отправлены на email и доступны ниже."}
        </p>

        {!paid && (
          <div className="panel">
            <div className="row between"><span>Номер заказа</span><strong>{order.publicId}</strong></div>
            <div className="row between"><span>Событие</span><strong>{order.event.title}</strong></div>
            <div className="row between"><span>Статус</span><strong>{order.status}</strong></div>
          </div>
        )}

        {awaitingPayment && (
          <div style={{ marginTop: 20 }}>
            <DemoPaymentButton publicId={order.publicId} />
            {order.paymentDueAt && <p className="muted">Оплатить нужно до {order.paymentDueAt.toLocaleString("ru-RU")}</p>}
          </div>
        )}

        {paid && walletReady && (
          <section
            aria-label="Apple Wallet"
            style={{
              marginTop: 22,
              padding: "20px 22px",
              borderRadius: 18,
              background: "linear-gradient(135deg,#060606 0%,#1f2937 100%)",
              color: "white",
              textAlign: "left",
              boxShadow: "0 14px 35px rgba(17,24,39,.18)",
            }}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span style={{ width: 44, height: 44, borderRadius: 13, background: "rgba(255,255,255,.12)", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                <WalletCards size={24} />
              </span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".12em", color: "#d1d5db", textTransform: "uppercase" }}>Быстрый вход</div>
                <h2 style={{ margin: "5px 0 7px", color: "white", fontSize: 22 }}>Добавьте билеты в Apple Wallet</h2>
                <p style={{ margin: 0, color: "#d1d5db", lineHeight: 1.55, fontSize: 14 }}>
                  Сохраните билет на iPhone, чтобы QR-код всегда был под рукой.
                </p>
              </div>
            </div>
          </section>
        )}

        {paid && <ResendTicketButton publicId={order.publicId} />}

        {paid && order.tickets.map((ticket, index) => (
          <TicketCard key={ticket.id} ticket={ticket} qr={qrs[index]} design={design} event={order.event} orderNumber={order.publicId} walletReady={walletReady} />
        ))}
        <Link href="/" className="btn dark" style={{ marginTop: 20 }}>
          Вернуться к событиям
        </Link>
      </section>
    </main>
  );
}
