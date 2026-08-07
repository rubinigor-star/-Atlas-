import { db } from "@/lib/db";
import { parseTicketDesign } from "@/lib/ticket-template";
import { getTicketLocale } from "@/lib/ticket-language";

type Locale = "ru" | "he" | "en";

function baseUrl() {
  return (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[char] || char);
}

function resendFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  return configured && !configured.startsWith("re_") && configured.includes("@")
    ? configured
    : "Atlas One <tickets@mail.atlas-one.co>";
}

function deliverableEmail(value: string) {
  return Boolean(value && !value.endsWith("@guest.atlas.local"));
}

async function sendEmail(input: {
  publicId: string;
  recipient: string;
  subject: string;
  html: string;
  logType: "approval-request-email" | "cancellation-email";
}) {
  if (!deliverableEmail(input.recipient)) return { skipped: true as const };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend API key не настроен в Vercel");
  const recipient = process.env.RESEND_TEST_TO || input.recipient;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: resendFromAddress(), to: [recipient], subject: input.subject, html: input.html }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`;
    console.error(`[${input.logType}]`, { publicId: input.publicId, recipient, status: response.status, message });
    throw new Error(message);
  }
  return { id: payload?.id as string | undefined, recipient };
}

const requestCopy = {
  ru: {
    subject: "Ваша заявка отправлена организатору",
    title: "Заявка получена",
    hello: "Здравствуйте",
    text: "Мы получили вашу заявку и передали её организатору на рассмотрение. Оплата на этом этапе не требуется.",
    next: "После решения организатора мы отправим вам отдельное письмо. Если заявка будет одобрена, билеты придут на email автоматически.",
    order: "Заявка",
    open: "Открыть заявку",
  },
  he: {
    subject: "הבקשה שלך נשלחה למפיק",
    title: "הבקשה התקבלה",
    hello: "שלום",
    text: "קיבלנו את הבקשה שלך והעברנו אותה למפיק לבדיקה. אין צורך בתשלום בשלב זה.",
    next: "לאחר החלטת המפיק נשלח אליך הודעה נוספת. אם הבקשה תאושר, הכרטיסים יישלחו אוטומטית למייל.",
    order: "בקשה",
    open: "פתיחת הבקשה",
  },
  en: {
    subject: "Your request was sent to the organizer",
    title: "Request received",
    hello: "Hello",
    text: "We received your request and sent it to the organizer for review. No payment is required at this stage.",
    next: "We will email you again after the organizer makes a decision. If approved, your tickets will be emailed automatically.",
    order: "Request",
    open: "Open request",
  },
} as const;

const cancellationCopy = {
  ru: {
    subject: "Ваш заказ отменён",
    title: "Билеты отменены",
    hello: "Здравствуйте",
    text: "Ваш заказ отменён, а все билеты по нему больше недействительны.",
    refund: "Возврат оформлен на сумму",
    bank: "Срок зачисления средств зависит от банка и платёжной системы.",
    order: "Заказ",
    open: "Открыть заказ",
  },
  he: {
    subject: "ההזמנה שלך בוטלה",
    title: "הכרטיסים בוטלו",
    hello: "שלום",
    text: "ההזמנה שלך בוטלה וכל הכרטיסים בה אינם תקפים עוד.",
    refund: "בוצע זיכוי בסך",
    bank: "מועד הופעת הזיכוי תלוי בבנק ובחברת האשראי.",
    order: "הזמנה",
    open: "פתיחת ההזמנה",
  },
  en: {
    subject: "Your order was cancelled",
    title: "Tickets cancelled",
    hello: "Hello",
    text: "Your order was cancelled and all tickets in it are no longer valid.",
    refund: "A refund was processed for",
    bank: "The time it takes to appear depends on your bank and payment provider.",
    order: "Order",
    open: "Open order",
  },
} as const;

function shell(input: { locale: Locale; title: string; body: string }) {
  const direction = input.locale === "he" ? "rtl" : "ltr";
  return `<!doctype html><html lang="${input.locale}" dir="${direction}"><body style="margin:0;background:#f3f4f6;padding:24px 10px;font-family:Arial,sans-serif;color:#111827"><table role="presentation" width="100%"><tr><td align="center"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="background:#081426;padding:28px 30px;color:#fff;border-top:7px solid #ff5c45"><div style="font-size:14px;font-weight:800;letter-spacing:.08em">ATLAS ONE</div><h1 style="margin:14px 0 0;font-size:28px;line-height:34px">${escapeHtml(input.title)}</h1></td></tr><tr><td style="padding:28px 30px;font-size:15px;line-height:23px">${input.body}</td></tr></table><div style="max-width:620px;color:#9ca3af;font-size:12px;text-align:center;padding:18px 20px">Atlas One</div></td></tr></table></body></html>`;
}

export async function sendApprovalRequestReceivedEmail(publicId: string, requestedLocale?: string) {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: true } });
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "PENDING_APPROVAL") throw new Error("Подтверждение заявки можно отправить только для заявки на рассмотрении");
  const locale: Locale = requestedLocale === "he" || requestedLocale === "en" ? requestedLocale : "ru";
  const copy = requestCopy[locale];
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  const body = `<p style="margin:0 0 18px">${copy.hello}, ${escapeHtml(order.customerName)}.</p><h2 style="margin:0 0 14px;font-size:21px">${escapeHtml(order.event.title)}</h2><p>${copy.text}</p><p>${copy.next}</p><p style="margin-top:20px"><strong>${copy.order}:</strong> ${escapeHtml(order.publicId)}</p><div style="text-align:center;margin-top:26px"><a href="${orderUrl}" style="display:inline-block;background:#ff5c45;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:800">${copy.open}</a></div>`;
  return sendEmail({ publicId, recipient: order.customerEmail, subject: `${copy.subject} - ${order.event.title}`, html: shell({ locale, title: copy.title, body }), logType: "approval-request-email" });
}

export async function sendOrderCancellationEmail(publicId: string, amountMinor: number) {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { include: { ticketTemplate: true } } } });
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "CANCELLED") throw new Error("Уведомление об отмене можно отправить только для отменённого заказа");
  const design = parseTicketDesign(order.event.ticketTemplate);
  const locale = getTicketLocale(design) as Locale;
  const copy = cancellationCopy[locale] || cancellationCopy.ru;
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  const amount = `${(amountMinor / 100).toFixed(2)} ₪`;
  const body = `<p style="margin:0 0 18px">${copy.hello}, ${escapeHtml(order.customerName)}.</p><h2 style="margin:0 0 14px;font-size:21px">${escapeHtml(order.event.title)}</h2><p>${copy.text}</p><p><strong>${copy.refund} ${escapeHtml(amount)}.</strong> ${copy.bank}</p><p style="margin-top:20px"><strong>${copy.order}:</strong> ${escapeHtml(order.publicId)}</p><div style="text-align:center;margin-top:26px"><a href="${orderUrl}" style="display:inline-block;background:#ff5c45;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:800">${copy.open}</a></div>`;
  return sendEmail({ publicId, recipient: order.customerEmail, subject: `${copy.subject} - ${order.event.title}`, html: shell({ locale, title: copy.title, body }), logType: "cancellation-email" });
}
