import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

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

const WIDTH = 840;
const HEIGHT = 1360;
const BRAND_NAVY = "#071426";
const BRAND_CORAL = "#ff5c45";

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&apos;", '"': "&quot;" })[char] || char);
}

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

function text(params: {
  x: number;
  y: number;
  value: string;
  size: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  letterSpacing?: number;
}) {
  const direction = isHebrew(params.value) ? "rtl" : "ltr";
  const anchor = params.anchor || (direction === "rtl" ? "end" : "start");
  return `<text x="${params.x}" y="${params.y}" fill="${params.fill}" font-family="DejaVu Sans, Noto Sans, Arial, sans-serif" font-size="${params.size}" font-weight="${params.weight || 400}" text-anchor="${anchor}" direction="${direction}" unicode-bidi="plaintext" letter-spacing="${params.letterSpacing || 0}">${escapeXml(params.value)}</text>`;
}

async function loadPosterDataUrl(posterUrl?: string | null) {
  if (!posterUrl) return null;
  try {
    let source: Buffer;
    if (posterUrl.startsWith("/")) {
      if (posterUrl.includes("..")) return null;
      source = await readFile(path.join(process.cwd(), "public", posterUrl));
    } else if (/^https?:\/\//i.test(posterUrl)) {
      const response = await fetch(posterUrl, { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return null;
      source = Buffer.from(await response.arrayBuffer());
    } else {
      return null;
    }
    const image = await sharp(source)
      .resize(840, 420, { fit: "cover", position: "attention" })
      .jpeg({ quality: 84, progressive: true })
      .toBuffer();
    return `data:image/jpeg;base64,${image.toString("base64")}`;
  } catch {
    return null;
  }
}

function infoRow(label: string, value: string, y: number, max: number) {
  const display = clip(value, max);
  const x = isHebrew(display) ? 760 : 80;
  return `${text({ x: 80, y, value: label, size: 17, fill: BRAND_CORAL, weight: 800, letterSpacing: 1.2 })}${text({ x, y: y + 39, value: display, size: 27, fill: "#101827", weight: 600 })}`;
}

async function renderTicketPng(input: TicketPdfInput) {
  const qr = await QRCode.toDataURL(input.ticketCode, {
    width: 900,
    margin: 2,
    errorCorrectionLevel: "Q",
    color: { dark: "#071426", light: "#ffffff" },
  });
  const poster = await loadPosterDataUrl(input.posterUrl);
  const eventTitle = clip(input.eventTitle, 54);
  const location = [input.venueCity, input.venueName].filter(Boolean).join(" · ");
  const address = clip(input.venueAddress, 70);
  const titleX = isHebrew(eventTitle) ? 780 : 60;

  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
    <rect width="${WIDTH}" height="${HEIGHT}" fill="#f2f5f9"/>
    ${poster ? `<image x="0" y="0" width="840" height="420" href="${poster}" preserveAspectRatio="xMidYMid slice"/><rect width="840" height="420" fill="#071426" opacity="0.68"/>` : `<rect width="840" height="420" fill="${BRAND_NAVY}"/>`}
    <rect y="410" width="840" height="10" fill="${BRAND_CORAL}"/>

    ${text({ x: 60, y: 82, value: "ATLAS", size: 52, fill: "#ffffff", weight: 900, letterSpacing: 2 })}
    ${text({ x: 64, y: 121, value: "ONE", size: 20, fill: BRAND_CORAL, weight: 800, letterSpacing: 5 })}
    ${text({ x: titleX, y: 244, value: eventTitle, size: 41, fill: "#ffffff", weight: 900 })}
    ${text({ x: 60, y: 302, value: formatDate(input.startsAt), size: 23, fill: "#e0e8f2", weight: 600 })}
    ${text({ x: isHebrew(location) ? 780 : 60, y: 345, value: clip(location, 58), size: 22, fill: "#ffffff", weight: 700 })}

    <rect x="44" y="458" width="752" height="386" rx="24" fill="#ffffff" stroke="#dbe2eb" stroke-width="2"/>
    ${infoRow("ПЛОЩАДКА", input.venueName, 514, 48)}
    ${infoRow("АДРЕС", [input.venueCity, address].filter(Boolean).join(", "), 598, 66)}
    ${infoRow("ВЛАДЕЛЕЦ", input.holderName, 682, 48)}
    ${infoRow("КАТЕГОРИЯ", input.categoryName, 766, 48)}

    <rect x="44" y="874" width="752" height="424" rx="24" fill="#ffffff" stroke="#dbe2eb" stroke-width="2"/>
    <rect x="71" y="903" width="370" height="370" rx="18" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <image x="87" y="919" width="338" height="338" href="${qr}"/>

    ${text({ x: 482, y: 948, value: "БИЛЕТ", size: 17, fill: BRAND_CORAL, weight: 800, letterSpacing: 1.2 })}
    ${text({ x: 482, y: 991, value: clip(input.ticketCode, 24), size: 19, fill: "#101827", weight: 700 })}
    ${text({ x: 482, y: 1061, value: "ЗАКАЗ", size: 17, fill: BRAND_CORAL, weight: 800, letterSpacing: 1.2 })}
    ${text({ x: 482, y: 1104, value: clip(input.orderNumber, 24), size: 22, fill: "#101827", weight: 800 })}
    ${text({ x: 482, y: 1180, value: "Покажите QR-код", size: 20, fill: "#465267", weight: 700 })}
    ${text({ x: 482, y: 1213, value: "при входе", size: 20, fill: "#465267", weight: 700 })}

    ${text({ x: 420, y: 1332, value: "atlas-one.co", size: 16, fill: "#687489", weight: 700, anchor: "middle", letterSpacing: 1 })}
  </svg>`;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");

  const pdf = await PDFDocument.create();
  pdf.setTitle(`Atlas One tickets - ${tickets[0].orderNumber}`);
  pdf.setAuthor("Atlas One");
  pdf.setCreator("Atlas One Ticket Service");
  pdf.setProducer("Atlas One");
  pdf.setCreationDate(new Date());
  pdf.setModificationDate(new Date());

  for (const ticket of tickets) {
    const png = await renderTicketPng(ticket);
    const image = await pdf.embedPng(png);
    const page = pdf.addPage([420, 680]);
    page.drawImage(image, { x: 0, y: 0, width: 420, height: 680 });
  }

  return Buffer.from(await pdf.save({ useObjectStreams: false, addDefaultPage: false }));
}
