import { db } from "@/lib/db";

function baseUrl() {
  return (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

function resendFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  return configured && !configured.startsWith("re_") && configured.includes("@")
    ? configured
    : "Atlas One <tickets@mail.atlas-one.co>";
}

export async function sendOrderCancellationEmail(publicId: string, refundedMinor: number, cancellationPublicId?: string) {
  const order = await db.order.findUnique({
    where: { publicId },
    include: { event: true },
  });
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "CANCELLED") throw new Error("Уведомление об отмене можно отправить только для отменённого заказа");

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend API key не настроен в Vercel");

  const recipient = process.env.RESEND_TEST_TO || order.customerEmail;
  const amount = `${(refundedMinor / 100).toFixed(2)} ₪`;
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  const requestLine = cancellationPublicId ? `<p>Номер заявки: <strong>${escapeHtml(cancellationPublicId)}</strong>.</p>` : "";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromAddress(),
      to: [recipient],
      subject: cancellationPublicId ? `Возврат выполнен - ${cancellationPublicId}` : `Заказ отменён - ${order.event.title}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px"><h1 style="margin:0">Билеты отменены, возврат оформлен</h1></div><div style="padding:26px"><p>Здравствуйте, ${escapeHtml(order.customerName)}.</p>${requestLine}<p>Ваш заказ <strong>${escapeHtml(order.publicId)}</strong> на мероприятие <strong>${escapeHtml(order.event.title)}</strong> отменён.</p><p>HYP подтвердил возврат на сумму <strong>${escapeHtml(amount)}</strong>. Срок фактического зачисления средств на карту зависит от банка и платёжной системы.</p><p><strong>Все билеты и QR-коды по этому заказу больше недействительны.</strong></p><p><a href="${orderUrl}">Открыть заказ</a></p></div></div>`,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`;
    console.error("[cancellation-email]", { publicId, cancellationPublicId: cancellationPublicId || null, recipient, status: response.status, message });
    throw new Error(message);
  }
  console.info("cancellation.refund_email.sent", { publicId, cancellationPublicId: cancellationPublicId || null, recipient, emailId: payload?.id || null, refundedMinor });
  return { id: payload?.id as string | undefined, recipient };
}
