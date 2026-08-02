import { db } from "@/lib/db";
import { generateTicketPdf } from "@/lib/ticket-pdf";
import { parseTicketDesign } from "@/lib/ticket-template";

function baseUrl() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL) {
    return `https://${process.env.VERCEL_BRANCH_URL}`.replace(/\/$/, "");
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}
function formatDate(value: Date) { return new Intl.DateTimeFormat("ru-IL", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(value); }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char); }
function resendFromAddress() {
  const configured = process.env.RESEND_FROM_EMAIL?.trim();
  const valid = configured && !configured.startsWith("re_") && configured.includes("@");
  return valid ? configured : "Atlas One <tickets@mail.atlas-one.co>";
}
function walletConfigured() {
  return Boolean(
    process.env.APPLE_WALLET_PASS_TYPE_ID &&
    process.env.APPLE_WALLET_TEAM_ID &&
    process.env.APPLE_WALLET_SIGNER_CERT_BASE64 &&
    process.env.APPLE_WALLET_SIGNER_KEY_BASE64 &&
    process.env.APPLE_WALLET_WWDR_CERT_BASE64,
  );
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
  const order = await getOrder(publicId);
  const recipient = process.env.RESEND_TEST_TO || order.customerEmail;
  const design = parseTicketDesign(order.event.ticketTemplate);
  const pdf = await makePdf(order);
  const appUrl = baseUrl();
  const orderUrl = `${appUrl}/orders/${encodeURIComponent(order.publicId)}`;
  const walletReady = walletConfigured();
  const ticketRows = order.tickets.map((ticket, index) => {
    const walletUrl = `${appUrl}/api/wallet/tickets/${encodeURIComponent(ticket.id)}`;
    const walletButton = walletReady
      ? `<a href="${walletUrl}" style="display:inline-block;background:#050505;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:700;line-height:18px;white-space:nowrap">&#63743;&nbsp; Add to Apple Wallet</a>`
      : "";
    return `<tr><td style="padding:14px 0;border-top:${index === 0 ? "0" : `1px solid ${design.accentColor}35`}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding-right:16px"><div style="font-size:12px;color:${design.textColor};opacity:.62;text-transform:uppercase;letter-spacing:.08em">Билет ${index + 1}</div><div style="font-size:17px;font-weight:800;color:${design.textColor};margin-top:4px">${escapeHtml(ticket.holderName)}</div><div style="font-size:14px;color:${design.textColor};opacity:.72;margin-top:3px">${escapeHtml(ticket.category.name)}</div></td><td align="right" style="vertical-align:middle">${walletButton}</td></tr></table></td></tr>`;
  }).join("");

  return sendResendEmail({
    publicId,
    recipient,
    subject: `Ваши билеты Atlas One — ${order.event.title}`,
    html: `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#111827"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(17,24,39,.08)"><tr><td style="background:${design.backgroundColor};padding:30px;color:${design.textColor};border-top:7px solid ${design.accentColor}"><div style="font-size:12px;font-weight:900;letter-spacing:.18em;color:${design.accentColor}">ATLAS ONE</div><h1 style="margin:12px 0 6px;font-size:30px;line-height:36px;color:${design.textColor}">Ваши билеты готовы</h1><p style="margin:0;color:${design.textColor};opacity:.72;font-size:15px">Сохраните их в телефоне или используйте PDF во вложении.</p></td></tr><tr><td style="padding:28px 30px"><p style="margin:0 0 18px;font-size:16px">Здравствуйте, ${escapeHtml(order.customerName)}.</p><h2 style="margin:0 0 14px;font-size:23px">${escapeHtml(order.event.title)}</h2><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${design.backgroundColor};border:1px solid ${design.accentColor}55;border-radius:16px;padding:18px"><tr><td style="font-size:14px;line-height:22px;color:${design.textColor}"><strong>Дата:</strong> ${escapeHtml(formatDate(order.event.startsAt))}<br><strong>Место:</strong> ${escapeHtml(order.event.venue.name)}, ${escapeHtml(order.event.venue.address)}<br><strong>Заказ:</strong> ${escapeHtml(order.publicId)}</td></tr>${walletReady ? `<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${ticketRows}</table></td></tr>` : ""}</table>${walletReady ? `<div style="margin-top:18px;font-size:13px;color:#6b7280">Каждый билет добавляется в Apple Wallet отдельно и содержит собственный QR-код.</div>` : ""}<div style="text-align:center;margin-top:26px"><a href="${orderUrl}" style="display:inline-block;background:${design.accentColor};color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:11px;font-size:15px;font-weight:800">Открыть заказ и все билеты</a></div><p style="margin:22px 0 0;color:#6b7280;font-size:13px;line-height:19px">PDF со всеми билетами приложен к письму. Каждый QR-код уникален и действует только для одного прохода.</p></td></tr></table><div style="max-width:640px;color:#9ca3af;font-size:12px;line-height:18px;text-align:center;padding:18px 20px">Atlas One · Электронные билеты и быстрый вход</div></td></tr></table></body></html>`,
    attachments: [{ filename: `atlas-one-${order.publicId}.pdf`, content: pdf }],
    logType: "ticket-email",
  });
}
export async function sendOrderRejectionEmail(publicId: string) {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { include: { venue: true } } } }); if (!order) throw new Error("Заказ не найден"); if (order.status !== "REJECTED") throw new Error("Уведомление об отказе можно отправить только для отклонённой заявки");
  const recipient = process.env.RESEND_TEST_TO || order.customerEmail; const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`; const rejectionMessage = order.reviewNote || "К сожалению, ваша заявка не была подтверждена. Авторизация оплаты отменена, списание не производилось.";
  return sendResendEmail({ publicId, recipient, subject: `Статус вашей заявки — ${order.event.title}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px"><h1>Обновление по вашей заявке</h1></div><div style="padding:26px"><p>Здравствуйте, ${escapeHtml(order.customerName)}.</p><h2>${escapeHtml(order.event.title)}</h2><p>${escapeHtml(rejectionMessage)}</p><p><a href="${orderUrl}">Открыть заявку</a></p></div></div>`, logType: "rejection-email" });
}
