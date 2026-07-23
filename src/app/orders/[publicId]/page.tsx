import QRCode from "qrcode";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { money, eventDate } from "@/lib/format";
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
  const pending = order.status === "PENDING_APPROVAL";
  const rejected = order.status === "REJECTED";
  const awaitingPayment = order.status === "AWAITING_PAYMENT";
  const design=parseTicketDesign(order.event.ticketTemplate);
  const walletReady=Boolean(process.env.APPLE_WALLET_PASS_TYPE_ID&&process.env.APPLE_WALLET_TEAM_ID&&process.env.APPLE_WALLET_SIGNER_CERT_BASE64&&process.env.APPLE_WALLET_SIGNER_KEY_BASE64&&process.env.APPLE_WALLET_WWDR_CERT_BASE64);

  return (
    <main className="shell">
      <section className="panel success">
        {pending && <Clock3 color="#d68b00" size={58} />}
        {rejected && <XCircle color="#b42318" size={58} />}
        {!pending && !rejected && <CheckCircle2 color="#0c9b66" size={58} />}

        <h1>
          {pending
            ? "Заявка отправлена"
            : rejected
              ? "Заявка отклонена"
              : awaitingPayment
                ? "Заявка одобрена"
                : "Заказ оформлен"}
        </h1>
        <p className="muted">
          {pending && "Организатор проверит данные. До одобрения оплата и выпуск билета недоступны."}
          {rejected && (order.reviewNote || "Организатор не подтвердил участие в мероприятии.")}
          {awaitingPayment && "Организатор подтвердил участие. Теперь можно завершить тестовую оплату и получить билет."}
          {order.status === "PAID" && "Тестовая оплата подтверждена. Деньги не списывались. Билеты доступны ниже и отправляются на email."}
        </p>

        <div className="panel">
          <div className="row between"><span>Номер</span><strong>{order.publicId}</strong></div>
          <div className="row between"><span>Событие</span><strong>{order.event.title}</strong></div>
          <div className="row between"><span>Дата</span><strong>{eventDate(order.event.startsAt)}</strong></div>
          <div className="row between"><span>Статус</span><strong>{order.status}</strong></div>
          <div className="row between"><span>Сумма</span><strong>{money(order.totalMinor)}</strong></div>
          <div className="row between"><span>Email</span><strong>{order.customerEmail}</strong></div>
        </div>

        {awaitingPayment && (
          <div style={{ marginTop: 20 }}>
            <DemoPaymentButton publicId={order.publicId} />
            {order.paymentDueAt && <p className="muted">Оплатить нужно до {order.paymentDueAt.toLocaleString("ru-RU")}</p>}
          </div>
        )}

        {order.status === "PAID" && <ResendTicketButton publicId={order.publicId} />}

        {order.tickets.map((ticket, index) => (
          <TicketCard key={ticket.id} ticket={ticket} qr={qrs[index]} design={design} event={order.event} orderNumber={order.publicId} walletReady={walletReady} />
        ))}
        <Link href="/" className="btn dark" style={{ marginTop: 20 }}>
          Вернуться к событиям
        </Link>
      </section>
    </main>
  );
}
