import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import type { TicketDesign, TicketElement } from "@/lib/ticket-template";
import { defaultTicketDesign, resolveTicketText } from "@/lib/ticket-template";

export type TicketPdfInput = {
  eventTitle: string;
  startsAt: Date;
  venueName: string;
  venueCity: string;
  venueAddress: string;
  posterUrl?: string | null;
  holderName: string;
  categoryName: string;
  orderNumber: string;
  ticketCode: string;
  ticketStatus?: "VALID" | "USED" | "CANCELLED" | "REFUNDED";
  design?: TicketDesign;
};

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 680;
const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OpenSans%5Bwdth,wght%5D.ttf";
let fontBytesPromise: Promise<Uint8Array> | null = null;
let atlasLogoBytesPromise: Promise<Buffer> | null = null;

function hex(value: string) {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "000000";
  return rgb(parseInt(clean.slice(0, 2), 16) / 255, parseInt(clean.slice(2, 4), 16) / 255, parseInt(clean.slice(4, 6), 16) / 255);
}
function containsHebrew(value: string) { return /[\u0590-\u05FF]/.test(value); }
function visualText(value: string) { return containsHebrew(value) ? Array.from(value).reverse().join("") : value; }
function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }
function clip(value: string, max = 90) { const text = clean(value); return text.length > max ? `${text.slice(0, max - 1)}…` : text; }
async function getFontBytes() {
  if (!fontBytesPromise) fontBytesPromise = fetch(FONT_URL, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Atlas-One-Ticket-Service/4.0" } }).then(async response => {
    if (!response.ok) throw new Error(`Не удалось загрузить TTF-шрифт: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  });
  return fontBytesPromise;
}
async function loadOfficialAtlasLogo(pdf: PDFDocument) {
  if (!atlasLogoBytesPromise) {
    const logoPath = path.join(process.cwd(), "public", "branding", "atlas-one-logo-official.jpg.b64");
    atlasLogoBytesPromise = readFile(logoPath, "utf8").then(encoded => Buffer.from(encoded.trim(), "base64"));
  }
  return pdf.embedJpg(await atlasLogoBytesPromise);
}
async function loadImage(pdf: PDFDocument, url?: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const absolute = url.startsWith("http") ? url : `${(process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "")}/${url.replace(/^\/+/, "")}`;
    const response = await fetch(absolute, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = response.headers.get("content-type") || "";
    return type.includes("png") || absolute.toLowerCase().endsWith(".png") ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
  } catch { return null; }
}
function fit(font: PDFFont, value: string, preferred: number, maxWidth: number) {
  let size = preferred;
  const text = visualText(value);
  while (size > 6 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 0.5;
  return size;
}
function drawTextElement(page: PDFPage, font: PDFFont, element: TicketElement, value: string) {
  const text = visualText(clip(value));
  if (!text) return;
  const x0 = PAGE_WIDTH * element.x / 100;
  const top = PAGE_HEIGHT * element.y / 100;
  const width = PAGE_WIDTH * element.width / 100;
  const height = PAGE_HEIGHT * element.height / 100;
  const size = fit(font, text, Math.max(7, element.fontSize * 0.72), width);
  const measured = font.widthOfTextAtSize(text, size);
  let x = x0;
  if (element.align === "center") x = x0 + (width - measured) / 2;
  if (element.align === "right" || containsHebrew(value)) x = x0 + width - measured;
  const y = PAGE_HEIGHT - top - Math.min(height, size * 1.25);
  page.drawText(text, { x: Math.max(0, x), y: Math.max(0, y), size, font, color: hex(element.color), maxWidth: width });
}
async function drawTicketPage(pdf: PDFDocument, font: PDFFont, ticket: TicketPdfInput) {
  const design = ticket.design || defaultTicketDesign();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: hex(design.backgroundColor) });
  const background = await loadImage(pdf, design.backgroundUrl || ticket.posterUrl);
  if (background && design.backgroundUrl) page.drawImage(background, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, opacity: 0.35 });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: hex(design.accentColor) });
  const customLogo = await loadImage(pdf, design.logoUrl);
  const logo = customLogo || await loadOfficialAtlasLogo(pdf);
  const ratio = logo.width / logo.height;
  const logoWidth = 145;
  const logoHeight = Math.min(54, logoWidth / ratio);
  page.drawImage(logo, { x: 28, y: PAGE_HEIGHT - 28 - logoHeight, width: logoWidth, height: logoHeight });
  const qrBytes = await QRCode.toBuffer(ticket.ticketCode, { width: 1000, margin: 2, errorCorrectionLevel: "Q" });
  const qr = await pdf.embedPng(qrBytes);
  const data = { eventTitle: ticket.eventTitle, startsAt: ticket.startsAt, venue: ticket.venueName, address: [ticket.venueCity, ticket.venueAddress].filter(Boolean).join(", "), customerName: ticket.holderName, ticketType: ticket.categoryName, orderNumber: ticket.orderNumber, ticketCode: ticket.ticketCode };
  for (const element of design.elements.filter(item => !item.hidden)) {
    const x = PAGE_WIDTH * element.x / 100;
    const top = PAGE_HEIGHT * element.y / 100;
    const width = PAGE_WIDTH * element.width / 100;
    const height = PAGE_HEIGHT * element.height / 100;
    const y = PAGE_HEIGHT - top - height;
    if (element.binding === "QR") {
      page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), borderColor: hex("#D8E0EA"), borderWidth: 1 });
      const padding = Math.min(7, width * 0.05, height * 0.05);
      page.drawImage(qr, { x: x + padding, y: y + padding, width: width - padding * 2, height: height - padding * 2 });
    } else if (element.binding === "IMAGE") {
      const image = await loadImage(pdf, element.content);
      if (image) page.drawImage(image, { x, y, width, height });
    } else {
      drawTextElement(page, font, element, resolveTicketText(element, data));
    }
  }
  const footerColor = design.backgroundColor.toLowerCase() === "#081426" ? "#B5C0CF" : "#667085";
  page.drawText("Powered by Atlas One · atlas-one.co", { x: 118, y: 10, size: 8, font, color: hex(footerColor) });
}
export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getFontBytes(), { subset: true });
  pdf.setTitle(`Atlas One tickets - ${tickets[0].orderNumber}`);
  pdf.setAuthor("Atlas One");
  for (const ticket of tickets) await drawTicketPage(pdf, font, ticket);
  return Buffer.from(await pdf.save({ useObjectStreams: false, addDefaultPage: false }));
}
