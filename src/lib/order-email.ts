import QRCode from "qrcode";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "@/lib/db";
import { drawMultilingualText } from "@/lib/pdf-multilingual";

function baseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
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

async function loadFonts(pdf: PDFDocument) {
  const root = path.join(process.cwd(), "node_modules");
  const read = (relative: string) => readFile(path.join(root, relative));
  const [latinRegular, latinBold, cyrillicRegular, cyrillicBold, hebrew] = await Promise.all([
    read("@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff"),
    read("@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff"),
    read("@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff"),
    read("@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff"),
    read("@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff"),
  ]);
  return {
    latinRegular: await pdf.embedFont(latinRegular, { subset: false }),
    latinBold: await pdf.embedFont(latinBold, { subset: false }),
    cyrillicRegular: await pdf.embedFont(cyrillicRegular, { subset: false }),
    cyrillicBold: await pdf.embedFont(cyrillicBold, { subset: false }),
    hebrew: await pdf.embedFont(hebrew, { subset: false }),
  };
}

async function makePdf(order: Awaited<ReturnType<typeof getOrder>>) {
  try {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const fonts = await loadFonts(pdf);
    const navy = rgb(0.031, 0.075, 0.145);
    const coral = rgb(1, 0.35, 0.28);
    const ink = rgb(0.06, 0.09, 0.15);
    const muted = rgb(0.38, 0.44, 0.55);
    const pale = rgb(0.95, 0.97, 0.99);

    for (const ticket of order.tickets) {
      const page = pdf.addPage([420, 680]);
      page.drawRectangle({ x: 0, y: 0, width: 420, height: 680, color: pale });
      page.drawRectangle({ x: 0, y: 505, width: 420, height: 175, color: navy });
      page.drawRectangle({ x: 0, y: 498, width: 420, height: 7, color: coral });

      drawMultilingualText({ page, value: "ATLAS", x: 28, y: 632, size: 24, fonts, bold: true, color: rgb(1, 1, 1), maxWidth: 170 });
      drawMultilingualText({ page, value: "DIGITAL TICKET", x: 28, y: 608, size: 9, fonts, bold: true, color: coral, maxWidth: 170 });
      drawMultilingualText({ page, value: order.event.title.slice(0, 72), x: 28, y: 555, size: 19, fonts, bold: true, color: rgb(1, 1, 1), maxWidth: 364 });
      drawMultilingualText({ page, value: formatDate(order.event.startsAt), x: 28, y: 526, size: 11, fonts, color: rgb(0.82, 0.87, 0.94), maxWidth: 364 });

      page.drawRectangle({ x: 24, y: 285, width: 372, height: 190, color: rgb(1, 1, 1), borderColor: rgb(0.86, 0.89, 0.93), borderWidth: 1 });
      const infoRows = [
        ["Место", `${order.event.venue.name}, ${order.event.venue.address}`],
        ["Владелец", ticket.holderName],
        ["Категория", ticket.category.name],
        ["Номер заказа", order.publicId],
      ] as const;
      let y = 443;
      for (const [label, value] of infoRows) {
        drawMultilingualText({ page, value: label.toUpperCase(), x: 42, y, size: 8, fonts, bold: true, color: coral, maxWidth: 130 });
        drawMultilingualText({ page, value: value.slice(0, 90), x: 42, y: y - 20, size: 12, fonts, bold: label === "Владелец", color: ink, maxWidth: 330 });
        y -= 43;
      }

      const qrData = await QRCode.toDataURL(ticket.publicCode, { margin: 1, width: 700, errorCorrectionLevel: "M" });
      const qr = await pdf.embedPng(Buffer.from(qrData.split(",")[1], "base64"));
      page.drawRectangle({ x: 105, y: 55, width: 210, height: 210, color: rgb(1, 1, 1), borderColor: rgb(0.86, 0.89, 0.93), borderWidth: 1 });
      page.drawImage(qr, { x: 119, y: 69, width: 182, height: 182 });
      drawMultilingualText({ page, value: "Покажите QR-код на входе", x: 112, y: 32, size: 10, fonts, bold: true, color: muted, maxWidth: 230 });
      drawMultilingualText({ page, value: ticket.publicCode, x: 28, y: 12, size: 7, fonts, color: muted, maxWidth: 364 });
    }
    return Buffer.from(await pdf.save()).toString("base64");
  } catch (error) {
    const message = error instanceof Error ? error.message : "неизвестная ошибка";
    console.error("[ticket-pdf] generation failed", { publicId: order.publicId, message });
    throw new Error(`Не удалось сформировать PDF билета: ${message}`);
  }
}

export async function sendOrderTicketEmail(publicId: string) {
  const order = await getOrder(publicId);
  const recipient = process.env.RESEND_TEST_TO || order.customerEmail;
  const pdf = await makePdf(order);
  const orderUrl = `${baseUrl()}/orders/${encodeURIComponent(order.publicId)}`;
  return sendResendEmail({ publicId, recipient, subject: `Ваши билеты Atlas — ${order.event.title}`, html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#111827"><div style="background:#081426;color:white;padding:26px;border-radius:16px 16px 0 0"><div style="font-size:13px;letter-spacing:2px;color:#ff5947">ATLAS TICKETS</div><h1 style="margin:10px 0 0">Билеты готовы</h1></div><div style="padding:26px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 16px 16px"><p>Здравствуйте, ${escapeHtml(order.customerName)}.</p><h2>${escapeHtml(order.event.title)}</h2><p><strong>Дата:</strong> ${escapeHtml(formatDate(order.event.startsAt))}<br><strong>Место:</strong> ${escapeHtml(order.event.venue.name)}, ${escapeHtml(order.event.venue.address)}<br><strong>Заказ:</strong> ${escapeHtml(order.publicId)}</p><p>Во вложении находится обновлённый билет Atlas с QR-кодом.</p><p style="text-align:center;margin-top:24px"><a href="${orderUrl}" style="display:inline-block;background:#111827;color:white;text-decoration:none;padding:13px 20px;border-radius:10px">Открыть заказ и билеты</a></p><p style="font-size:12px;color:#6b7280">Сохраните письмо до окончания мероприятия.</p></div></div>`, attachments: [{ filename: `atlas-${order.publicId}.pdf`, content: pdf }], logType: "ticket-email" });
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
