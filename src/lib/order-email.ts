import { db } from "@/lib/db";
import { generateTicketPdf } from "@/lib/ticket-pdf";
import { parseTicketDesign } from "@/lib/ticket-template";

function baseUrl() { return (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, ""); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("ru-IL", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(value); }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char); }
function resendFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  const valid = configured && !configured.startsWith("re_") && configured.includes("@");
  return valid ? configured : "Atlas One <tickets@mail.atlas-one.co>";
}
async function sendResendEmail(input: { publicId: string; recipient: string; subject: string; html: string; attachments?: Array<{ filename: string; content: string }>; logType: "ticket-email" | "rejection-email" }) {
  const apiKey = process.env.RESEND_API_KEY; const from = resendFromAddress();
  if (!apiKey) throw new Error("Resend API key не настроен в Vercel");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [input.recipient], subject: input.subject, html: input.html, attachments: input.attachments }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) { const message = typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`; console.error(`[${input.logType}]`, { publicId: input.publicId, recipient: input.recipient, status: response.status, message }); throw new Error(message); }
  return { id: payload?.id as string | undefined, recipient: input.recipient };
}
async function getOrder(publicId: string) {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { include: { venue: true, ticketTemplate: true } }, tickets: { include: { category: true } } } });
  if (!order) throw new Error("Заказ не найден"); if (order.status !== "PAID") throw new Error("Билет можно отправить только после оплаты"); if (!order.tickets.length) throw new Error("В заказе ещё нет билетов"); return order;
}
async function makePdf(order: Awaited<ReturnType<typeof getOrder>>) {
  try {
    const design = parseTicketDesign(order.event.ticketTemplate);
    const bytes = await generateTicketPdf(order.tickets.map(ticket => ({ eventTitle: order.event.title, startsAt: order.event.startsAt, venueName: order.event.venue.name, venueCity: order.event.venue.city, venueAddress: order.event.venue.address, posterUrl: order.event.posterUrl, holderName: ticket.holderName, categoryName: ticket.category.name, orderNumber: order.publicId, ticketCode: ticket.publicCode, ticketStatus: ticket.status, design })));
    return bytes.toString("base64");
  } catch (error) { const message = error instanceof Error ? error.message : "неизвестная ошибка"; console.error("[ticket-pdf] generation failed", { publicId: order.publicId, message }); throw new Error(`Не удалось сформировать PDF билета: ${message}`); }
}
export async function sendOrderTicketEmail(publicId: string) {
  const order = await getOrder(publicId); const recipient = process.env.RESEND_TEST_TO || order.customerEmail; const pdf = await makePdf(order); const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  return sendResendEmail({ publicId, recipient, subject: `Ваши билеты Atlas One — ${order.event.title}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:2px;color:#ff5947">ATLAS ONE</div><h1 style="margin:10px 0 0">Билеты готовы</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>Здравствуйте, ${escapeHtml(order.customerName)}.</p><h2>${escapeHtml(order.event.title)}</h2><p><strong>Дата:</strong> ${escapeHtml(formatDate(order.event.startsAt))}<br><strong>Место:</strong> ${escapeHtml(order.event.venue.name)}, ${escapeHtml(order.event.venue.address)}<br><strong>Заказ:</strong> ${escapeHtml(order.publicId)}</p><p>Во вложении находится PDF с выбранным организатором шаблоном билета и QR-кодом.</p><p style="text-align:center;margin-top:24px"><a href="${orderUrl}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:13px 20px;border-radius:10px">Открыть заказ и билеты</a></p></div></div>`, attachments: [{ filename: `atlas-one-${order.publicId}.pdf`, content: pdf }], logType: "ticket-email" });
}
export async function sendOrderRejectionEmail(publicId: string) {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { include: { venue: true } } } }); if (!order) throw new Error("Заказ не найден"); if (order.status !== "REJECTED") throw new Error("Уведомление об отказе можно отправить только для отклонённой заявки");
  const recipient = process.env.RESEND_TEST_TO || order.customerEmail; const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`; const rejectionMessage = order.reviewNote || "К сожалению, ваша заявка не была подтверждена. Авторизация оплаты отменена, списание не производилось.";
  return sendResendEmail({ publicId, recipient, subject: `Статус вашей заявки — ${order.event.title}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px"><h1>Обновление по вашей заявке</h1></div><div style="padding:26px"><p>Здравствуйте, ${escapeHtml(order.customerName)}.</p><h2>${escapeHtml(order.event.title)}</h2><p>${escapeHtml(rejectionMessage)}</p><p><a href="${orderUrl}">Открыть заявку</a></p></div></div>`, logType: "rejection-email" });
}
