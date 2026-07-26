import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";

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
const FONT_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/opensans/OpenSans%5Bwdth,wght%5D.ttf";
const NAVY = rgb(0.027, 0.078, 0.149);
const CORAL = rgb(1, 0.361, 0.271);
const INK = rgb(0.063, 0.094, 0.153);
const MUTED = rgb(0.275, 0.322, 0.404);
const PALE = rgb(0.949, 0.965, 0.98);
const BORDER = rgb(0.859, 0.886, 0.922);
const WHITE = rgb(1, 1, 1);
let fontBytesPromise: Promise<Uint8Array> | null = null;
let atlasLogoBytesPromise: Promise<Buffer> | null = null;

function clean(value: string) { return value.replace(/\s+/g, " ").trim(); }
function clip(value: string, max: number) { const normalized = clean(value); return normalized.length > max ? `${normalized.slice(0, Math.max(1, max - 1))}…` : normalized; }
function containsHebrew(value: string) { return /[\u0590-\u05FF]/.test(value); }
function visualText(value: string) { return containsHebrew(value) ? Array.from(value).reverse().join("") : value; }
function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-IL", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Jerusalem" }).format(value);
}
async function getFontBytes() {
  if (!fontBytesPromise) fontBytesPromise = fetch(FONT_URL, { signal: AbortSignal.timeout(15000), headers: { "user-agent": "Atlas-One-Ticket-Service/3.0" } }).then(async (response) => {
    if (!response.ok) throw new Error(`Не удалось загрузить TTF-шрифт: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  });
  return fontBytesPromise;
}
async function loadPoster(pdf: PDFDocument, posterUrl?: string | null): Promise<PDFImage | null> {
  if (!posterUrl) return null;
  try {
    const absolute = posterUrl.startsWith("http") ? posterUrl : `${(process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "")}/${posterUrl.replace(/^\/+/, "")}`;
    const response = await fetch(absolute, { signal: AbortSignal.timeout(10000), headers: { "user-agent": "Atlas-One-Ticket-Service/3.0" } });
    if (!response.ok) return null;
    const source = Buffer.from(await response.arrayBuffer());
    const jpeg = await sharp(source).resize(840, 420, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toBuffer();
    return pdf.embedJpg(jpeg);
  } catch (error) {
    console.warn("[ticket-pdf] poster unavailable", { posterUrl, message: error instanceof Error ? error.message : "unknown error" });
    return null;
  }
}
async function loadOfficialAtlasLogo(pdf: PDFDocument) {
  if (!atlasLogoBytesPromise) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="190" viewBox="0 0 560 190">
      <rect width="560" height="190" rx="16" fill="#ffffff" fill-opacity="0.97"/>
      <text x="280" y="92" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="78" font-weight="900" letter-spacing="-5">
        <tspan fill="#0b1830">ATL</tspan><tspan fill="#ff5c45">AS</tspan>
      </text>
      <line x1="120" y1="130" x2="220" y2="130" stroke="#ff5c45" stroke-width="3"/>
      <text x="283" y="142" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="900" letter-spacing="13" fill="#ff5c45">ONE</text>
      <line x1="340" y1="130" x2="440" y2="130" stroke="#ff5c45" stroke-width="3"/>
    </svg>`;
    atlasLogoBytesPromise = sharp(Buffer.from(svg)).png().toBuffer();
  }
  return pdf.embedPng(await atlasLogoBytesPromise);
}
function width(font: PDFFont, value: string, size: number) { return font.widthOfTextAtSize(visualText(value), size); }
function fit(font: PDFFont, value: string, maxWidth: number, preferred: number, minimum: number) { let size = preferred; while (size > minimum && width(font, value, size) > maxWidth) size -= 0.5; return size; }
function draw(page: PDFPage, font: PDFFont, value: string, x: number, y: number, size: number, color = INK, maxWidth?: number) {
  const text = visualText(value);
  const actualX = containsHebrew(value) && maxWidth ? x + Math.max(0, maxWidth - font.widthOfTextAtSize(text, size)) : x;
  page.drawText(text, { x: actualX, y, size, font, color, maxWidth });
}
function infoRow(page: PDFPage, font: PDFFont, label: string, value: string, y: number, maxChars: number) {
  draw(page, font, label, 40, y, 8.5, CORAL, 330);
  const display = clip(value, maxChars);
  draw(page, font, display, 40, y - 20, fit(font, display, 330, 13.5, 9.5), INK, 330);
}
async function drawTicketPage(pdf: PDFDocument, font: PDFFont, ticket: TicketPdfInput) {
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: PALE });
  const poster = await loadPoster(pdf, ticket.posterUrl);
  if (poster) page.drawImage(poster, { x: 0, y: 470, width: PAGE_WIDTH, height: 210 });
  page.drawRectangle({ x: 0, y: 470, width: PAGE_WIDTH, height: 210, color: NAVY, opacity: poster ? 0.7 : 1 });
  page.drawRectangle({ x: 0, y: 465, width: PAGE_WIDTH, height: 5, color: CORAL });
  const atlasLogo = await loadOfficialAtlasLogo(pdf);
  page.drawImage(atlasLogo, { x: 28, y: 607, width: 178, height: 60.4 });
  const title = clip(ticket.eventTitle, 58);
  draw(page, font, title, 30, 565, fit(font, title, 360, 21, 13), WHITE, 360);
  draw(page, font, formatDate(ticket.startsAt), 30, 535, 10.5, rgb(0.88, 0.92, 0.97), 360);
  draw(page, font, clip([ticket.venueCity, ticket.venueName].filter(Boolean).join(" · "), 65), 30, 512, 10, WHITE, 360);
  page.drawRectangle({ x: 22, y: 255, width: 376, height: 190, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  infoRow(page, font, "ПЛОЩАДКА", ticket.venueName, 414, 52);
  infoRow(page, font, "АДРЕС", [ticket.venueCity, ticket.venueAddress].filter(Boolean).join(", "), 371, 72);
  infoRow(page, font, "ВЛАДЕЛЕЦ", ticket.holderName, 328, 52);
  infoRow(page, font, "КАТЕГОРИЯ", ticket.categoryName, 285, 52);
  page.drawRectangle({ x: 22, y: 26, width: 376, height: 210, color: WHITE, borderColor: BORDER, borderWidth: 1 });
  const qrBytes = await QRCode.toBuffer(ticket.ticketCode, { width: 900, margin: 2, errorCorrectionLevel: "Q" });
  const qr = await pdf.embedPng(qrBytes);
  page.drawImage(qr, { x: 42, y: 48, width: 166, height: 166 });
  draw(page, font, "БИЛЕТ", 240, 195, 8.5, CORAL, 145);
  draw(page, font, clip(ticket.ticketCode, 24), 240, 174, 9.5, INK, 145);
  draw(page, font, "ЗАКАЗ", 240, 139, 8.5, CORAL, 145);
  draw(page, font, clip(ticket.orderNumber, 24), 240, 116, 11, INK, 145);
  draw(page, font, "Покажите QR-код", 240, 75, 10, MUTED, 145);
  draw(page, font, "при входе", 240, 59, 10, MUTED, 145);
  draw(page, font, "Powered by Atlas One · atlas-one.co", 118, 10, 8, MUTED, 205);
}
export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await getFontBytes(), { subset: true });
  pdf.setTitle(`Atlas One tickets - ${tickets[0].orderNumber}`);
  pdf.setAuthor("Atlas One");
  pdf.setCreator("Atlas One Ticket Service");
  for (const ticket of tickets) await drawTicketPage(pdf, font, ticket);
  return Buffer.from(await pdf.save({ useObjectStreams: false, addDefaultPage: false }));
}
