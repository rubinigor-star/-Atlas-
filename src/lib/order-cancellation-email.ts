import { db } from "@/lib/db";
import { normalizeLocale } from "@/lib/i18n";

export const cancellationCopy={
  ru:{refundSubject:"Возврат выполнен",cancelSubject:"Заказ отменён",title:"Билеты отменены, возврат оформлен",hello:"Здравствуйте",request:"Номер заявки",order:"Ваш заказ",event:"на мероприятие",cancelled:"отменён",refund:"Организатор подтвердил возврат на сумму",refundTail:"Возврат уже оформлен на исходный способ оплаты. Срок фактического зачисления средств зависит от банка и платёжной системы.",invalid:"Все билеты и QR-коды по этому заказу больше недействительны.",open:"Посмотреть отменённый заказ"},
  he:{refundSubject:"ההחזר בוצע",cancelSubject:"ההזמנה בוטלה",title:"הכרטיסים בוטלו וההחזר בוצע",hello:"שלום",request:"מספר בקשה",order:"ההזמנה שלך",event:"לאירוע",cancelled:"בוטלה",refund:"המפיק אישר החזר בסך",refundTail:"ההחזר הועבר לאמצעי התשלום המקורי. מועד הזיכוי בפועל תלוי בבנק ובחברת האשראי.",invalid:"כל הכרטיסים וקודי ה-QR בהזמנה זו אינם תקפים יותר.",open:"לצפייה בהזמנה שבוטלה"},
  en:{refundSubject:"Refund completed",cancelSubject:"Order cancelled",title:"Tickets cancelled and refund issued",hello:"Hello",request:"Request number",order:"Your order",event:"for",cancelled:"has been cancelled",refund:"The organizer approved a refund of",refundTail:"The refund was issued to the original payment method. Posting time depends on your bank and card network.",invalid:"All tickets and QR codes in this order are no longer valid.",open:"View cancelled order"},
} as const;

function baseUrl() {
  return (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '\"': "&quot;" })[char] || char);
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
  const locale=normalizeLocale(order.communicationLocale);const c=cancellationCopy[locale];const dir=locale==="he"?"rtl":"ltr";
  const amount = `${(refundedMinor / 100).toFixed(2)} ₪`;
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  const requestLine = cancellationPublicId ? `<p>${c.request}: <strong>${escapeHtml(cancellationPublicId)}</strong>.</p>` : "";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromAddress(),
      to: [recipient],
      subject: cancellationPublicId ? `${c.refundSubject} - ${cancellationPublicId}` : `${c.cancelSubject} - ${order.event.title}`,
      html: `<div lang="${locale}" dir="${dir}" style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px"><h1 style="margin:0">${c.title}</h1></div><div style="padding:26px"><p>${c.hello}, ${escapeHtml(order.customerName)}.</p>${requestLine}<p>${c.order} <strong>${escapeHtml(order.publicId)}</strong> ${c.event} <strong>${escapeHtml(order.event.title)}</strong> ${c.cancelled}.</p><p>${c.refund} <strong>${escapeHtml(amount)}</strong>. ${c.refundTail}</p><p><strong>${c.invalid}</strong></p><p><a href="${orderUrl}">${c.open}</a></p></div></div>`,
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
