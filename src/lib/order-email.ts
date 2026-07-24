import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://atlas-atlasteam1.vercel.app").replace(/\/$/, "");
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jerusalem" }).format(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] || char);
}

async function sendResendEmail(input: { publicId: string; recipient: string; subject: string; html: string; attachments?: Array<{ filename: string; content: string }>; logType: "ticket-email" | "rejection-email" }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend не настроен в Vercel");
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [input.recipient], subject: input.subject, html: input.html, attachments: input.attachments }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload?.message === "string" ? payload.message : `Resend: ${response.status}`;
    console.error(`[${input.logType}]`, { publicId: input.publicId, recipient: input.recipient, status: response.status, message });
    throw new Error(message);
  }
  console.info(`[${input.logType}] sent`, { publicId: input.publicId, recipient: input.recipient, resendId: payload?.id });
  return { id: payload?.id as string | undefined, recipient: input.recipient };
}

async function getOrder(publicId: string) {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { include: { venue: true } }, tickets: { include: { category: true } } } });
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "PAID") throw new Error("Билет можно отправить только после оплаты");
  if (!order.tickets.length) throw new Error("В заказе ещё нет билетов");
  return order;
}

async function makePdf(order: Awaited<ReturnType<typeof getOrder>>) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (const ticket of order.tickets) {
    const page = pdf.addPage([420, 595]);
    page.drawRectangle({ x: 0, y: 0, width: 420, height: 595, color: rgb(0.035, 0.078, 0.145) });
    page.drawText("ATLAS", { x: 28, y: 545, size: 22, font: bold, color: rgb(1, 1, 1) });
    page.drawText(order.event.title.slice(0, 40), { x: 28, y: 500, size: 18, font: bold, color: rgb(1, 1, 1) });
    page.drawText(formatDate(order.event.startsAt), { x: 28, y: 468, size: 11, font: regular, color: rgb(0.85, 0.88, 0.93) });
    page.drawText(`${order.event.venue.name}, ${order.event.venue.address}`.slice(0, 65), { x: 28, y: 445, size: 10, font: regular, color: rgb(0.85, 0.88, 0.93) });
    page.drawText(`Holder: ${ticket.holderName}`.slice(0, 60), { x: 28, y: 400, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText(`Category: ${ticket.category.name}`.slice(0, 60), { x: 28, y: 378, size: 11, font: regular, color: rgb(1, 1, 1) });
    page.drawText(`Order: ${order.publicId}`, { x: 28, y: 356, size: 10, font: regular, color: rgb(0.85, 0.88, 0.93) });
    const qrData = await QRCode.toDataURL(ticket.publicCode, { margin: 1, width: 500, errorCorrectionLevel: "M" });
    const qr = await pdf.embedPng(Buffer.from(qrData.split(",")[1], "base64"));
    page.drawImage(qr, { x: 105, y: 105, width: 210, height: 210 });
    page.drawText("Show this QR code at the entrance", { x: 103, y: 78, size: 10, font: regular, color: rgb(0.85, 0.88, 0.93) });
  }
  return Buffer.from(await pdf.save()).toString("base64");
}

export async function sendOrderTicketEmail(publicId: string) {
  const order = await getOrder(publicId);
  const recipient = process.env.RESEND_TEST_TO || order.customerEmail;
  const pdf = await makePdf(order);
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  return sendResendEmail({ publicId, recipient, subject: `Ваши билеты Atlas — ${order.event.title}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:2px">ATLAS TICKETS</div><h1 style="margin:10px 0 0">Билеты готовы</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>Здравствуйте, ${escapeHtml(order.customerName)}.</p><h2>${escapeHtml(order.event.title)}</h2><p><strong>Дата:</strong> ${escapeHtml(formatDate(order.event.startsAt))}<br><strong>Место:</strong> ${escapeHtml(order.event.venue.name)}, ${escapeHtml(order.event.venue.address)}<br><strong>Заказ:</strong> ${escapeHtml(order.publicId)}</p><p>В приложенном PDF находятся ${order.tickets.length} билет(а) с QR-кодами.</p><p style="text-align:center;margin-top:24px"><a href="${orderUrl}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:13px 20px;border-radius:10px">Открыть заказ и билеты</a></p><p style="font-size:12px;color:#6b7280">Сохраните письмо до окончания мероприятия.</p></div></div>`, attachments: [{ filename: `atlas-${order.publicId}.pdf`, content: pdf }], logType: "ticket-email" });
}

export async function sendOrderRejectionEmail(publicId: string) {
  const order = await db.order.findUnique({ where: { publicId }, include: { event: { include: { venue: true } } } });
  if (!order) throw new Error("Заказ не найден");
  if (order.status !== "REJECTED") throw new Error("Уведомление об отказе можно отправить только для отклонённой заявки");
  const recipient = process.env.RESEND_TEST_TO || order.customerEmail;
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  const rejectionMessage = order.reviewNote || "К сожалению, ваша заявка не была подтверждена. Авторизация оплаты отменена, списание не производилось.";
  return sendResendEmail({ publicId, recipient, subject: `Статус вашей заявки — ${order.event.title}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:2px">ATLAS TICKETS</div><h1 style="margin:10px 0 0">Обновление по вашей заявке</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>Здравствуйте, ${escapeHtml(order.customerName)}.</p><h2>${escapeHtml(order.event.title)}</h2><p style="white-space:pre-line;line-height:1.6">${escapeHtml(rejectionMessage)}</p><p><strong>Дата:</strong> ${escapeHtml(formatDate(order.event.startsAt))}<br><strong>Место:</strong> ${escapeHtml(order.event.venue.name)}, ${escapeHtml(order.event.venue.address)}<br><strong>Номер заявки:</strong> ${escapeHtml(order.publicId)}</p><p style="text-align:center;margin-top:24px"><a href="${orderUrl}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:13px 20px;border-radius:10px">Открыть заявку</a></p><p style="font-size:12px;color:#6b7280">Это автоматическое уведомление Atlas.</p></div></div>`, logType: "rejection-email" });
}
