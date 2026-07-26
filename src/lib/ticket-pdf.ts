import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import type { TicketDesign, TicketElement } from "@/lib/ticket-template-types";
import { defaultTicketDesign, resolveTicketText } from "@/lib/ticket-template";

type TicketStatus = "VALID" | "USED" | "REFUNDED" | "CANCELLED";
type TicketPdfInput = {
  eventTitle: string; startsAt: Date; venueName: string; venueAddress: string; holderName: string; categoryName: string;
  orderNumber: string; ticketCode: string; status?: TicketStatus; design?: TicketDesign;
};
const WIDTH = 840;
const HEIGHT = 1360;

function escapeXml(value: string) { return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[char] || char); }
function clip(value: string, max = 58) { const clean = value.replace(/\s+/g, " ").trim(); return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean; }
function isHebrew(value: string) { return /[\u0590-\u05FF]/.test(value); }
function text(params: { x: number; y: number; value: string; size: number; fill: string; weight?: number; anchor?: "start" | "middle" | "end" }) {
  const direction = isHebrew(params.value) ? "rtl" : "ltr";
  const anchor = params.anchor || (direction === "rtl" ? "end" : "start");
  return `<text x="${params.x}" y="${params.y}" fill="${params.fill}" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="${params.size}" font-weight="${params.weight || 400}" text-anchor="${anchor}" direction="${direction}" unicode-bidi="plaintext">${escapeXml(params.value)}</text>`;
}
function atlasLogo(dark: boolean) {
  const main = dark ? "#FFFFFF" : "#081426";
  return `<g transform="translate(56 45)"><text x="0" y="55" fill="${main}" font-family="Arial,sans-serif" font-size="58" font-weight="900" letter-spacing="-4">ATL</text><text x="104" y="55" fill="#FF5C45" font-family="Arial,sans-serif" font-size="58" font-weight="900" letter-spacing="-4">AS</text><line x1="0" y1="78" x2="72" y2="78" stroke="#FF5C45" stroke-width="3"/><text x="88" y="86" fill="#FF5C45" font-family="Arial,sans-serif" font-size="22" font-weight="800" letter-spacing="7">ONE</text><line x1="164" y1="78" x2="236" y2="78" stroke="#FF5C45" stroke-width="3"/></g>`;
}
function statusStyle(status: TicketStatus) { switch (status) { case "USED": return { fill: "#fff4d6", text: "#8a5a00" }; case "REFUNDED": return { fill: "#e8eef7", text: "#344054" }; case "CANCELLED": return { fill: "#ffe7e3", text: "#b42318" }; default: return { fill: "#def7e8", text: "#067647" }; } }
function anchorFor(element: TicketElement) { return element.align === "center" ? "middle" : element.align === "right" ? "end" : "start"; }
function elementX(element: TicketElement) { const left = WIDTH * element.x / 100; const width = WIDTH * element.width / 100; return element.align === "center" ? left + width / 2 : element.align === "right" ? left + width : left; }
function renderTextElement(element: TicketElement, value: string) {
  const x = elementX(element); const y = HEIGHT * element.y / 100 + element.fontSize;
  return text({ x, y, value: clip(value, Math.max(18, Math.round(element.width * 0.9))), size: element.fontSize * 1.65, fill: element.color, weight: element.bold ? 800 : 400, anchor: anchorFor(element) });
}
async function ticketPng(input: TicketPdfInput) {
  const design = input.design || defaultTicketDesign();
  const qr = await QRCode.toDataURL(input.ticketCode, { width: 900, margin: 1, errorCorrectionLevel: "Q" });
  const qrBase64 = qr.split(",")[1];
  const status = input.status || "VALID"; const badge = statusStyle(status);
  const data = { eventTitle: input.eventTitle, startsAt: input.startsAt, venue: input.venueName, address: input.venueAddress, customerName: input.holderName, ticketType: input.categoryName, orderNumber: input.orderNumber, ticketCode: input.ticketCode };
  const dark = design.backgroundColor.toLowerCase() === "#081426" || design.backgroundColor.toLowerCase() === "#0c1930";
  const items: string[] = [];
  for (const element of design.elements.filter(item => !item.hidden)) {
    if (element.binding === "QR") {
      items.push(`<rect x="${WIDTH * element.x / 100}" y="${HEIGHT * element.y / 100}" width="${WIDTH * element.width / 100}" height="${HEIGHT * element.height / 100}" rx="18" fill="#FFFFFF" stroke="#D8E0EA" stroke-width="2"/><image x="${WIDTH * element.x / 100 + 12}" y="${HEIGHT * element.y / 100 + 12}" width="${WIDTH * element.width / 100 - 24}" height="${HEIGHT * element.height / 100 - 24}" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,${qrBase64}"/>`);
    } else if (element.binding !== "IMAGE") {
      items.push(renderTextElement(element, resolveTicketText(element, data)));
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}"><rect width="840" height="1360" fill="${design.backgroundColor}"/><rect width="840" height="12" fill="${design.accentColor}"/>${atlasLogo(dark)}<rect x="650" y="50" width="140" height="50" rx="25" fill="${badge.fill}"/>${text({ x: 720, y: 82, value: status, size: 17, fill: badge.text, weight: 800, anchor: "middle" })}<line x1="56" y1="180" x2="784" y2="180" stroke="${design.accentColor}" stroke-width="3" opacity=".7"/>${items.join("")}<text x="56" y="1320" fill="${dark ? "#D8E1ED" : "#667085"}" font-family="Arial,sans-serif" font-size="18">Powered by Atlas One</text><text x="784" y="1320" text-anchor="end" fill="${dark ? "#D8E1ED" : "#667085"}" font-family="Arial,sans-serif" font-size="18">atlas-one.co</text></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");
  const pdf = await PDFDocument.create();
  for (const ticket of tickets) { const png = await ticketPng(ticket); const image = await pdf.embedPng(png); const page = pdf.addPage([420, 680]); page.drawImage(image, { x: 0, y: 0, width: 420, height: 680 }); }
  return Buffer.from(await pdf.save());
}
