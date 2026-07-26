import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument, rgb, type PDFImage, type PDFPage, type RGB } from "pdf-lib";

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

type VectorFont = {
  unitsPerEm: number;
  layout: (value: string) => {
    glyphs: Array<{ path: { toSVG: () => string } }>;
    positions: Array<{ xAdvance: number; xOffset: number; yOffset: number }>;
  };
};

type VectorFonts = {
  regular: VectorFont;
  bold: VectorFont;
  hebrewRegular: VectorFont;
  hebrewBold: VectorFont;
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

function isHebrew(value: string) {
  return /[\u0590-\u05FF]/.test(value);
}

function splitByScript(value: string) {
  const parts: Array<{ value: string; hebrew: boolean }> = [];
  for (const char of Array.from(value)) {
    const hebrew = isHebrew(char);
    const last = parts[parts.length - 1];
    if (last?.hebrew === hebrew) last.value += char;
    else parts.push({ value: char, hebrew });
  }
  return parts;
}

async function loadVectorFonts(): Promise<VectorFonts> {
  const modules = path.join(process.cwd(), "node_modules");
  const load = (relativePath: string) => readFile(path.join(modules, relativePath));
  const [regular, bold, hebrewRegular, hebrewBold] = await Promise.all([
    load("@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff"),
    load("@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff"),
    load("@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff"),
    load("@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-700-normal.woff"),
  ]);
  const create = (fontkit as unknown as { create: (bytes: Uint8Array) => VectorFont }).create;
  return {
    regular: create(regular),
    bold: create(bold),
    hebrewRegular: create(hebrewRegular),
    hebrewBold: create(hebrewBold),
  };
}

function pathData(svg: string) {
  return svg.match(/d="([^"]+)"/)?.[1] || "";
}

function segmentLayout(font: VectorFont, value: string, size: number) {
  const layout = font.layout(value);
  const scale = size / font.unitsPerEm;
  const width = layout.positions.reduce((sum, position) => sum + position.xAdvance * scale, 0);
  return { ...layout, scale, width };
}

function vectorTextWidth(fonts: VectorFonts, value: string, size: number, bold = false) {
  return splitByScript(value).reduce((sum, part) => {
    const font = part.hebrew ? (bold ? fonts.hebrewBold : fonts.hebrewRegular) : (bold ? fonts.bold : fonts.regular);
    const rendered = part.hebrew ? Array.from(part.value).reverse().join("") : part.value;
    return sum + segmentLayout(font, rendered, size).width;
  }, 0);
}

function drawVectorText(params: {
  page: PDFPage;
  fonts: VectorFonts;
  value: string;
  x: number;
  y: number;
  size: number;
  color: RGB;
  bold?: boolean;
  maxWidth?: number;
}) {
  const { page, fonts, value, y, size, color, bold = false, maxWidth } = params;
  const width = vectorTextWidth(fonts, value, size, bold);
  let cursor = params.x;
  if (isHebrew(value) && maxWidth) cursor = params.x + Math.max(0, maxWidth - width);

  for (const part of splitByScript(value)) {
    const font = part.hebrew ? (bold ? fonts.hebrewBold : fonts.hebrewRegular) : (bold ? fonts.bold : fonts.regular);
    const rendered = part.hebrew ? Array.from(part.value).reverse().join("") : part.value;
    const layout = segmentLayout(font, rendered, size);
    for (let index = 0; index < layout.glyphs.length; index += 1) {
      const glyph = layout.glyphs[index];
      const position = layout.positions[index];
      const d = pathData(glyph.path.toSVG());
      if (d) {
        page.drawSvgPath(d, {
          x: cursor + position.xOffset * layout.scale,
          y: y + position.yOffset * layout.scale,
          scale: layout.scale,
          color,
        });
      }
      cursor += position.xAdvance * layout.scale;
      if (maxWidth && cursor > params.x + maxWidth) return;
    }
  }
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
        headers: { "user-agent": "Atlas-One-Ticket-Service/3.0" },
      });
      if (!response.ok) return null;
      source = Buffer.from(await response.arrayBuffer());
    } else {
      return null;
    }
    const jpeg = await sharp(source).resize(840, 420, { fit: "cover", position: "attention" }).jpeg({ quality: 86 }).toBuffer();
    return pdf.embedJpg(jpeg);
  } catch (error) {
    console.warn("[ticket-pdf] poster unavailable", { posterUrl, message: error instanceof Error ? error.message : "unknown error" });
    return null;
  }
}

function fitSize(value: string, maxWidth: number, preferred: number, minimum: number, fonts: VectorFonts, bold = false) {
  let size = preferred;
  while (size > minimum && vectorTextWidth(fonts, value, size, bold) > maxWidth) size -= 0.5;
  return size;
}

function drawInfoRow(page: PDFPage, fonts: VectorFonts, label: string, value: string, y: number, maxChars: number) {
  drawVectorText({ page, fonts, value: label, x: 40, y, size: 8.5, color: CORAL, bold: true, maxWidth: 330 });
  const display = clip(value, maxChars);
  const size = fitSize(display, 330, 13.5, 9.5, fonts, true);
  drawVectorText({ page, fonts, value: display, x: 40, y: y - 20, size, color: INK, bold: true, maxWidth: 330 });
}

async function drawTicketPage(pdf: PDFDocument, fonts: VectorFonts, ticket: TicketPdfInput) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PALE });

  const poster = await loadPoster(pdf, ticket.posterUrl);
  if (poster) page.drawImage(poster, { x: 0, y: 470, width: PAGE_WIDTH, height: 210 });
  else page.drawRectangle({ x: 0, y: 470, width: PAGE_WIDTH, height: 210, color: NAVY });
  page.drawRectangle({ x: 0, y: 470, width: PAGE_WIDTH, height: 210, color: NAVY, opacity: poster ? 0.68 : 1 });
  page.drawRectangle({ x: 0, y: 465, width: PAGE_WIDTH, height: 5, color: CORAL });

  drawVectorText({ page, fonts, value: "ATLAS", x: 30, y: 638, size: 26, color: WHITE, bold: true, maxWidth: 170 });
  drawVectorText({ page, fonts, value: "ONE", x: 32, y: 619, size: 10, color: CORAL, bold: true, maxWidth: 80 });
  const title = clip(ticket.eventTitle, 58);
  const titleSize = fitSize(title, 360, 21, 13, fonts, true);
  drawVectorText({ page, fonts, value: title, x: 30, y: 565, size: titleSize, color: WHITE, bold: true, maxWidth: 360 });
  drawVectorText({ page, fonts, value: formatDate(ticket.startsAt), x: 30, y: 535, size: 11, color: rgb(0.88, 0.92, 0.97), bold: true, maxWidth: 360 });
  drawVectorText({ page, fonts, value: clip([ticket.venueCity, ticket.venueName].filter(Boolean).join(" · "), 65), x: 30, y: 512, size: 10.5, color: WHITE, bold: true, maxWidth: 360 });

  page.drawRectangle({ x: 22, y: 255, width: 376, height: 190, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  drawInfoRow(page, fonts, "ПЛОЩАДКА", ticket.venueName, 414, 52);
  drawInfoRow(page, fonts, "АДРЕС", [ticket.venueCity, ticket.venueAddress].filter(Boolean).join(", "), 371, 72);
  drawInfoRow(page, fonts, "ВЛАДЕЛЕЦ", ticket.holderName, 328, 52);
  drawInfoRow(page, fonts, "КАТЕГОРИЯ", ticket.categoryName, 285, 52);

  page.drawRectangle({ x: 22, y: 26, width: 376, height: 210, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  const qrBytes = await QRCode.toBuffer(ticket.ticketCode, { width: 900, margin: 2, errorCorrectionLevel: "Q", color: { dark: "#071426", light: "#ffffff" } });
  const qr = await pdf.embedPng(qrBytes);
  page.drawRectangle({ x: 34, y: 40, width: 182, height: 182, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  page.drawImage(qr, { x: 43, y: 49, width: 164, height: 164 });

  drawVectorText({ page, fonts, value: "БИЛЕТ", x: 240, y: 195, size: 8.5, color: CORAL, bold: true, maxWidth: 145 });
  drawVectorText({ page, fonts, value: clip(ticket.ticketCode, 24), x: 240, y: 174, size: 9.5, color: INK, bold: true, maxWidth: 145 });
  drawVectorText({ page, fonts, value: "ЗАКАЗ", x: 240, y: 139, size: 8.5, color: CORAL, bold: true, maxWidth: 145 });
  drawVectorText({ page, fonts, value: clip(ticket.orderNumber, 24), x: 240, y: 116, size: 11, color: INK, bold: true, maxWidth: 145 });
  drawVectorText({ page, fonts, value: "Покажите QR-код", x: 240, y: 75, size: 10, color: MUTED, bold: true, maxWidth: 145 });
  drawVectorText({ page, fonts, value: "при входе", x: 240, y: 59, size: 10, color: MUTED, bold: true, maxWidth: 145 });
  drawVectorText({ page, fonts, value: "atlas-one.co", x: 170, y: 10, size: 8, color: MUTED, bold: true, maxWidth: 100 });
}

export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");
  const pdf = await PDFDocument.create();
  const fonts = await loadVectorFonts();
  pdf.setTitle(`Atlas One tickets - ${tickets[0].orderNumber}`);
  pdf.setAuthor("Atlas One");
  pdf.setCreator("Atlas One Ticket Service");
  pdf.setProducer("Atlas One");
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());
  for (const ticket of tickets) await drawTicketPage(pdf, fonts, ticket);
  return Buffer.from(await pdf.save({ useObjectStreams: false, addDefaultPage: false }));
}
