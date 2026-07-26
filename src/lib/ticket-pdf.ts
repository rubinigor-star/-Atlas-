import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import { drawMultilingualText, multilingualWidth, type PdfFontSet } from "@/lib/pdf-multilingual";

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
};

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 680;
const NAVY = rgb(0.027, 0.078, 0.149);
const CORAL = rgb(1, 0.361, 0.271);
const INK = rgb(0.063, 0.094, 0.153);
const MUTED = rgb(0.275, 0.322, 0.404);
const PALE = rgb(0.949, 0.965, 0.98);
const BORDER = rgb(0.859, 0.886, 0.922);
const WHITE = rgb(1, 1, 1);

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, max: number) {
  const normalized = clean(value);
  return normalized.length > max ? `${normalized.slice(0, Math.max(1, max - 1))}…` : normalized;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(value);
}

async function loadFonts(pdf: PDFDocument): Promise<PdfFontSet> {
  const modules = path.join(process.cwd(), "node_modules");
  const load = (relativePath: string) => readFile(path.join(modules, relativePath));
  const [regular, bold, hebrew] = await Promise.all([
    load("@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff"),
    load("@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff"),
    load("@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff"),
  ]);

  const regularFont = await pdf.embedFont(regular, { subset: false });
  const boldFont = await pdf.embedFont(bold, { subset: false });
  const hebrewFont = await pdf.embedFont(hebrew, { subset: false });

  return {
    latinRegular: regularFont,
    latinBold: boldFont,
    cyrillicRegular: regularFont,
    cyrillicBold: boldFont,
    hebrew: hebrewFont,
  };
}

async function loadPoster(pdf: PDFDocument, posterUrl?: string | null): Promise<PDFImage | null> {
  if (!posterUrl) return null;
  try {
    let source: Buffer;
    if (posterUrl.startsWith("/")) {
      if (posterUrl.includes("..")) return null;
      source = await readFile(path.join(process.cwd(), "public", posterUrl.replace(/^\/+/, "")));
    } else if (/^https?:\/\//i.test(posterUrl)) {
      const response = await fetch(posterUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "Atlas-One-Ticket-Service/2.0" },
      });
      if (!response.ok) return null;
      source = Buffer.from(await response.arrayBuffer());
    } else {
      return null;
    }

    const jpeg = await sharp(source)
      .resize(840, 420, { fit: "cover", position: "attention" })
      .jpeg({ quality: 86 })
      .toBuffer();
    return pdf.embedJpg(jpeg);
  } catch (error) {
    console.warn("[ticket-pdf] poster unavailable", {
      posterUrl,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return null;
  }
}

function fitSize(value: string, maxWidth: number, preferred: number, minimum: number, fonts: PdfFontSet, bold = false) {
  let size = preferred;
  while (size > minimum && multilingualWidth(value, size, fonts, bold) > maxWidth) size -= 0.5;
  return size;
}

function drawText(page: PDFPage, fonts: PdfFontSet, value: string, x: number, y: number, size: number, color = INK, bold = false, maxWidth?: number) {
  drawMultilingualText({ page, fonts, value, x, y, size, color, bold, maxWidth });
}

function drawInfoRow(page: PDFPage, fonts: PdfFontSet, label: string, value: string, y: number, maxChars: number) {
  drawText(page, fonts, label, 40, y, 8.5, CORAL, true, 330);
  const display = clip(value, maxChars);
  const size = fitSize(display, 330, 13.5, 9.5, fonts, true);
  drawText(page, fonts, display, 40, y - 20, size, INK, true, 330);
}

async function drawTicketPage(pdf: PDFDocument, fonts: PdfFontSet, ticket: TicketPdfInput) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PALE });

  const poster = await loadPoster(pdf, ticket.posterUrl);
  if (poster) page.drawImage(poster, { x: 0, y: 470, width: PAGE_WIDTH, height: 210 });
  else page.drawRectangle({ x: 0, y: 470, width: PAGE_WIDTH, height: 210, color: NAVY });
  page.drawRectangle({ x: 0, y: 470, width: PAGE_WIDTH, height: 210, color: NAVY, opacity: poster ? 0.68 : 1 });
  page.drawRectangle({ x: 0, y: 465, width: PAGE_WIDTH, height: 5, color: CORAL });

  drawText(page, fonts, "ATLAS", 30, 638, 26, WHITE, true, 170);
  drawText(page, fonts, "ONE", 32, 619, 10, CORAL, true, 80);

  const title = clip(ticket.eventTitle, 58);
  const titleSize = fitSize(title, 360, 21, 13, fonts, true);
  drawText(page, fonts, title, 30, 565, titleSize, WHITE, true, 360);
  drawText(page, fonts, formatDate(ticket.startsAt), 30, 535, 11, rgb(0.88, 0.92, 0.97), true, 360);
  drawText(page, fonts, clip([ticket.venueCity, ticket.venueName].filter(Boolean).join(" · "), 65), 30, 512, 10.5, WHITE, true, 360);

  page.drawRectangle({ x: 22, y: 255, width: 376, height: 190, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  drawInfoRow(page, fonts, "ПЛОЩАДКА", ticket.venueName, 414, 52);
  drawInfoRow(page, fonts, "АДРЕС", [ticket.venueCity, ticket.venueAddress].filter(Boolean).join(", "), 371, 72);
  drawInfoRow(page, fonts, "ВЛАДЕЛЕЦ", ticket.holderName, 328, 52);
  drawInfoRow(page, fonts, "КАТЕГОРИЯ", ticket.categoryName, 285, 52);

  page.drawRectangle({ x: 22, y: 26, width: 376, height: 210, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  const qrBytes = await QRCode.toBuffer(ticket.ticketCode, {
    width: 900,
    margin: 2,
    errorCorrectionLevel: "Q",
    color: { dark: "#071426", light: "#ffffff" },
  });
  const qr = await pdf.embedPng(qrBytes);
  page.drawRectangle({ x: 34, y: 40, width: 182, height: 182, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  page.drawImage(qr, { x: 43, y: 49, width: 164, height: 164 });

  drawText(page, fonts, "БИЛЕТ", 240, 195, 8.5, CORAL, true, 145);
  drawText(page, fonts, clip(ticket.ticketCode, 24), 240, 174, 9.5, INK, true, 145);
  drawText(page, fonts, "ЗАКАЗ", 240, 139, 8.5, CORAL, true, 145);
  drawText(page, fonts, clip(ticket.orderNumber, 24), 240, 116, 11, INK, true, 145);
  drawText(page, fonts, "Покажите QR-код", 240, 75, 10, MUTED, true, 145);
  drawText(page, fonts, "при входе", 240, 59, 10, MUTED, true, 145);
  drawText(page, fonts, "atlas-one.co", 170, 10, 8, MUTED, true, 100);
}

export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fonts = await loadFonts(pdf);

  pdf.setTitle(`Atlas One tickets - ${tickets[0].orderNumber}`);
  pdf.setAuthor("Atlas One");
  pdf.setCreator("Atlas One Ticket Service");
  pdf.setProducer("Atlas One");
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());

  for (const ticket of tickets) await drawTicketPage(pdf, fonts, ticket);

  return Buffer.from(await pdf.save({ useObjectStreams: false, addDefaultPage: false }));
}
