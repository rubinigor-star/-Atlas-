import { db } from "@/lib/db";
import { normalizeLocale, type Locale } from "@/lib/i18n";

function baseUrl() { return (process.env.PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, ""); }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char); }
function resendFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  return configured && !configured.startsWith("re_") && configured.includes("@") ? configured : "Atlas One <tickets@mail.atlas-one.co>";
}
function deliverableEmail(value: string) { return Boolean(value && !value.endsWith("@guest.atlas.local")); }
async function sendEmail(input: { publicId: string; recipient: string; subject: string; html: string }) {
  if (!deliverableEmail(input.recipient)) return { skipped: true as const };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Resend API key не настроен в Vercel");
  const recipient = process.env.RESEND_TEST_TO || input.recipient;
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: resendFromAddress(), to: [recipient], subject: input.subject, html: input.html }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`);
  return { id: payload?.id as string | undefined, recipient };
}
export const approvalRequestCopy = {
  ru: { subject: "Ваша заявка отправлена организатору", title: "Заявка получена", text: "Мы получили вашу заявку и передали её организатору на рассмотрение. Сумма заказа предварительно авторизована на вашей карте, но деньги ещё не списаны.", next: "Списание произойдёт только если организатор подтвердит заказ. После решения мы отправим отдельное письмо.", open:"Открыть заявку" },
  he: { subject: "הבקשה שלך נשלחה למפיק", title: "הבקשה התקבלה", text: "קיבלנו את הבקשה והעברנו אותה למפיק לבדיקה. סכום ההזמנה אושר מראש בכרטיס, אך עדיין לא בוצע חיוב.", next: "החיוב יתבצע רק אם המפיק יאשר את ההזמנה. נשלח אליך עדכון נוסף לאחר קבלת ההחלטה.", open:"לצפייה בבקשה" },
  en: { subject: "Your request was sent to the organizer", title: "Request received", text: "We received your request and sent it to the organizer for review. The order amount has been pre-authorized on your card, but no charge has been made yet.", next: "Your card will be charged only if the organizer approves the order. We will email you after the decision.", open:"Open request" },
} as const;
function shell(locale: Locale, title: string, body: string) { const dir = locale === "he" ? "rtl" : "ltr"; return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="font-family:Arial,sans-serif;background:#f3f4f6;padding:24px"><div style="max-width:620px;margin:auto;background:#fff;border-radius:18px;padding:28px"><h1>${escapeHtml(title)}</h1>${body}</div></body></html>`; }
export async function sendApprovalRequestReceivedEmail(publicId: string, requestedLocale?: string) {
  void requestedLocale;
  const order = await db.order.findUnique({ where: { publicId }, include: { event: true } });
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "PENDING_APPROVAL") throw new Error("Подтверждение заявки можно отправить только для заявки на рассмотрении");
  const locale=normalizeLocale(order.communicationLocale);
  const c = approvalRequestCopy[locale];
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  const body = `<p>${escapeHtml(order.customerName)},</p><h2>${escapeHtml(order.event.title)}</h2><p>${c.text}</p><p>${c.next}</p><p><strong>${escapeHtml(order.publicId)}</strong></p><p><a href="${orderUrl}">${c.open}</a></p>`;
  return sendEmail({ publicId, recipient: order.customerEmail, subject: `${c.subject} - ${order.event.title}`, html: shell(locale, c.title, body) });
}
