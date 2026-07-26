import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { TicketDesign, TicketElement } from "@/lib/ticket-template-types";
import { defaultTicketDesign, resolveTicketText } from "@/lib/ticket-template";

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
  design?: TicketDesign;
};

type FontSet = {
  latinRegular: PDFFont;
  latinBold: PDFFont;
  hebrewRegular: PDFFont;
  hebrewBold: PDFFont;
};

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 680;

function hexColor(value: string) {
  const clean = /^#[0-9a-f]{6}$/i.test(value) ? value.slice(1) : "000000";
  return rgb(
    Number.parseInt(clean.slice(0, 2), 16) / 255,
    Number.parseInt(clean.slice(2, 4), 16) / 255,
    Number.parseInt(clean.slice(4, 6), 16) / 255,
  );
}

function containsHebrew(value: string) {
  return /[\u0590-\u05FF]/.test(value);
}

function safeText(value: string, max = 90) {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

async function readFont(relativePath: string) {
  return readFile(path.join(process.cwd(), "node_modules", relativePath));
}

async function embedFonts(pdf: PDFDocument): Promise<FontSet> {
  pdf.registerFontkit(fontkit);
  try {
    const [latinRegularBytes, latinBoldBytes, hebrewRegularBytes, hebrewBoldBytes] = await Promise.all([
      readFont("@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff"),
      readFont("@fontsource/noto-sans/files/noto-sans-cyrillic-700-normal.woff"),
      readFont("@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-400-normal.woff"),
      readFont("@fontsource/noto-sans-hebrew/files/noto-sans-hebrew-hebrew-700-normal.woff"),
    ]);
    return {
      latinRegular: await pdf.embedFont(latinRegularBytes, { subset: true }),
      latinBold: await pdf.embedFont(latinBoldBytes, { subset: true }),
      hebrewRegular: await pdf.embedFont(hebrewRegularBytes, { subset: true }),
      hebrewBold: await pdf.embedFont(hebrewBoldBytes, { subset: true }),
    };
  } catch {
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    return { latinRegular: regular, latinBold: bold, hebrewRegular: regular, hebrewBold: bold };
  }
}

function fontFor(value: string, bold: boolean, fonts: FontSet) {
  if (containsHebrew(value)) return bold ? fonts.hebrewBold : fonts.hebrewRegular;
  return bold ? fonts.latinBold : fonts.latinRegular;
}

function fitText(value: string, font: PDFFont, requestedSize: number, maxWidth: number) {
  let size = requestedSize;
  while (size > 6 && font.widthOfTextAtSize(value, size) > maxWidth) size -= 0.5;
  return size;
}

function drawTextElement(page: PDFPage, element: TicketElement, value: string, fonts: FontSet) {
  const text = safeText(value);
  if (!text) return;

  const boxX = PAGE_WIDTH * element.x / 100;
  const boxTop = PAGE_HEIGHT * element.y / 100;
  const boxWidth = PAGE_WIDTH * element.width / 100;
  const boxHeight = PAGE_HEIGHT * element.height / 100;
  const font = fontFor(text, element.bold, fonts);
  const requestedSize = Math.max(6, element.fontSize * 0.82);
  const size = fitText(text, font, requestedSize, boxWidth);
  const measuredWidth = font.widthOfTextAtSize(text, size);

  let x = boxX;
  if (element.align === "center") x = boxX + (boxWidth - measuredWidth) / 2;
  if (element.align === "right") x = boxX + boxWidth - measuredWidth;

  const y = PAGE_HEIGHT - boxTop - Math.min(boxHeight, size * 1.25);
  page.drawText(text, {
    x: Math.max(0, x),
    y: Math.max(0, y),
    size,
    font,
    color: hexColor(element.color),
    maxWidth: boxWidth,
  });
}

async function embedRemoteImage(pdf: PDFDocument, url: string | null | undefined): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("png") || url.toLowerCase().endsWith(".png")) return pdf.embedPng(bytes);
    return pdf.embedJpg(bytes);
  } catch {
    return null;
  }
}

function drawAtlasLogo(page: PDFPage, fonts: FontSet, dark: boolean) {
  const main = dark ? "#FFFFFF" : "#081426";
  const atlas = fonts.latinBold;
  page.drawText("ATL", { x: 28, y: 622, size: 29, font: atlas, color: hexColor(main) });
  page.drawText("AS", { x: 80, y: 622, size: 29, font: atlas, color: hexColor("#FF5C45") });
  page.drawLine({ start: { x: 28, y: 610 }, end: { x: 64, y: 610 }, thickness: 1.5, color: hexColor("#FF5C45") });
  page.drawText("ONE", { x: 72, y: 603, size: 10, font: atlas, color: hexColor("#FF5C45") });
  page.drawLine({ start: { x: 108, y: 610 }, end: { x: 144, y: 610 }, thickness: 1.5, color: hexColor("#FF5C45") });
}

async function drawTicketPage(pdf: PDFDocument, input: TicketPdfInput, fonts: FontSet) {
  const design = input.design || defaultTicketDesign();
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: hexColor(design.backgroundColor) });

  const background = await embedRemoteImage(pdf, design.backgroundUrl);
  if (background) page.drawImage(background, { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, opacity: 0.42 });

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: hexColor(design.accentColor) });

  const dark = ["#081426", "#0c1930", "#07172e"].includes(design.backgroundColor.toLowerCase());
  const logo = await embedRemoteImage(pdf, design.logoUrl);
  if (logo) {
    const ratio = logo.width / logo.height;
    const width = 118;
    const height = Math.min(50, width / ratio);
    page.drawImage(logo, { x: 28, y: PAGE_HEIGHT - 28 - height, width, height });
  } else {
    drawAtlasLogo(page, fonts, dark);
  }

  const data = {
    eventTitle: input.eventTitle,
    startsAt: input.startsAt,
    venue: input.venueName,
    address: input.venueAddress,
    customerName: input.holderName,
    ticketType: input.categoryName,
    orderNumber: input.orderNumber,
    ticketCode: input.ticketCode,
  };

  const qrDataUrl = await QRCode.toDataURL(input.ticketCode, { width: 900, margin: 1, errorCorrectionLevel: "Q" });
  const qrImage = await pdf.embedPng(Buffer.from(qrDataUrl.split(",")[1], "base64"));

  for (const element of design.elements.filter(item => !item.hidden)) {
    const x = PAGE_WIDTH * element.x / 100;
    const top = PAGE_HEIGHT * element.y / 100;
    const width = PAGE_WIDTH * element.width / 100;
    const height = PAGE_HEIGHT * element.height / 100;
    const y = PAGE_HEIGHT - top - height;

    if (element.binding === "QR") {
      page.drawRectangle({ x, y, width, height, color: rgb(1, 1, 1), borderColor: hexColor("#D8E0EA"), borderWidth: 1, borderRadius: 7 });
      const padding = Math.min(8, width * 0.05, height * 0.05);
      page.drawImage(qrImage, { x: x + padding, y: y + padding, width: width - padding * 2, height: height - padding * 2 });
      continue;
    }

    if (element.binding === "IMAGE") {
      const image = await embedRemoteImage(pdf, element.content);
      if (image) page.drawImage(image, { x, y, width, height });
      continue;
    }

    drawTextElement(page, element, resolveTicketText(element, data), fonts);
  }

  const footerFont = fonts.latinRegular;
  const footerColor = hexColor(dark ? "#D8E1ED" : "#667085");
  page.drawText("Powered by Atlas One", { x: 28, y: 18, size: 8, font: footerFont, color: footerColor });
  const site = "atlas-one.co";
  page.drawText(site, { x: PAGE_WIDTH - 28 - footerFont.widthOfTextAtSize(site, 8), y: 18, size: 8, font: footerFont, color: footerColor });
}

export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");
  const pdf = await PDFDocument.create();
  const fonts = await embedFonts(pdf);
  for (const ticket of tickets) await drawTicketPage(pdf, ticket, fonts);
  return Buffer.from(await pdf.save());
}
