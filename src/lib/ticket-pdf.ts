import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

type TicketStatus = "VALID" | "USED" | "REFUNDED" | "CANCELLED";

type TicketPdfInput = {
  eventTitle: string;
  startsAt: Date;
  venueName: string;
  venueAddress: string;
  holderName: string;
  categoryName: string;
  orderNumber: string;
  ticketCode: string;
  status?: TicketStatus;
};

const WIDTH = 840;
const HEIGHT = 1360;

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[char] || char);
}

function clip(value: string, max = 58) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  }).format(value);
}

function isHebrew(value: string) {
  return /[\u0590-\u05FF]/.test(value);
}

function text(params: { x: number; y: number; value: string; size: number; fill: string; weight?: number; anchor?: "start" | "middle" | "end" }) {
  const direction = isHebrew(params.value) ? "rtl" : "ltr";
  const anchor = params.anchor || (direction === "rtl" ? "end" : "start");
  return `<text x="${params.x}" y="${params.y}" fill="${params.fill}" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="${params.size}" font-weight="${params.weight || 400}" text-anchor="${anchor}" direction="${direction}" unicode-bidi="plaintext">${escapeXml(params.value)}</text>`;
}

function statusStyle(status: TicketStatus) {
  switch (status) {
    case "USED":
      return { fill: "#fff4d6", text: "#8a5a00" };
    case "REFUNDED":
      return { fill: "#e8eef7", text: "#344054" };
    case "CANCELLED":
      return { fill: "#ffe7e3", text: "#b42318" };
    default:
      return { fill: "#def7e8", text: "#067647" };
  }
}

async function ticketPng(input: TicketPdfInput) {
  const qr = await QRCode.toDataURL(input.ticketCode, { width: 800, margin: 1, errorCorrectionLevel: "Q" });
  const venue = clip(`${input.venueName}, ${input.venueAddress}`, 72);
  const holder = clip(input.holderName, 44);
  const category = clip(input.categoryName, 44);
  const eventTitle = clip(input.eventTitle, 48);
  const qrBase64 = qr.split(",")[1];
  const status = input.status || "VALID";
  const badge = statusStyle(status);

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="840" height="1360" fill="#f3f6fa"/>
    <rect width="840" height="420" fill="#081426"/>
    <rect y="410" width="840" height="10" fill="#ff5947"/>

    <rect x="52" y="42" width="270" height="112" rx="18" fill="#ffffff" fill-opacity="0.97"/>
    ${text({ x: 76, y: 96, value: "ATLAS", size: 48, fill: "#081426", weight: 900 })}
    ${text({ x: 80, y: 132, value: "ONE", size: 20, fill: "#ff5947", weight: 800 })}

    <rect x="628" y="58" width="154" height="54" rx="27" fill="${badge.fill}"/>
    ${text({ x: 705, y: 93, value: status, size: 18, fill: badge.text, weight: 800, anchor: "middle" })}

    ${text({ x: 60, y: 235, value: eventTitle, size: 42, fill: "#ffffff", weight: 800 })}
    ${text({ x: 60, y: 295, value: formatDate(input.startsAt), size: 24, fill: "#d3deec", weight: 500 })}

    <rect x="48" y="470" width="744" height="380" rx="22" fill="#ffffff" stroke="#dce3ec" stroke-width="2"/>
    ${text({ x: 82, y: 530, value: "МЕСТО", size: 18, fill: "#ff5947", weight: 800 })}
    ${text({ x: 82, y: 572, value: venue, size: 27, fill: "#101827", weight: 500 })}
    ${text({ x: 82, y: 642, value: "ВЛАДЕЛЕЦ", size: 18, fill: "#ff5947", weight: 800 })}
    ${text({ x: isHebrew(holder) ? 758 : 82, y: 684, value: holder, size: 29, fill: "#101827", weight: 700 })}
    ${text({ x: 82, y: 754, value: "КАТЕГОРИЯ", size: 18, fill: "#ff5947", weight: 800 })}
    ${text({ x: isHebrew(category) ? 758 : 82, y: 796, value: category, size: 27, fill: "#101827", weight: 600 })}
    ${text({ x: 82, y: 838, value: `ЗАКАЗ ${input.orderNumber}`, size: 18, fill: "#687489", weight: 600 })}

    <rect x="185" y="875" width="470" height="470" rx="20" fill="#ffffff" stroke="#dce3ec" stroke-width="2"/>
    <image x="205" y="895" width="430" height="430" href="data:image/png;base64,${qrBase64}"/>
    ${text({ x: 420, y: 1340, value: clip(input.ticketCode, 62), size: 14, fill: "#687489", weight: 500, anchor: "middle" })}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");
  const pdf = await PDFDocument.create();
  for (const ticket of tickets) {
    const png = await ticketPng(ticket);
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([420, 680]);
    page.drawImage(image, { x: 0, y: 0, width: 420, height: 680 });
  }
  return Buffer.from(await pdf.save());
}
