import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TicketDesign, TicketElement } from "@/lib/ticket-template";
import { defaultTicketDesign, resolveTicketText } from "@/lib/ticket-template";

export type HtmlTicketInput = {
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

const WIDTH = 420;
const HEIGHT = 680;
let assetsPromise: Promise<{ latin: string; hebrew: string; logo: string }> | null = null;

function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] || char);
}

function safeUrl(value?: string | null) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
  return `${base}/${value.replace(/^\/+/, "")}`;
}

async function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = Promise.all([
      readFile(path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans", "files", "noto-sans-cyrillic-400-normal.woff")),
      readFile(path.join(process.cwd(), "node_modules", "@fontsource", "noto-sans-hebrew", "files", "noto-sans-hebrew-hebrew-400-normal.woff")),
      readFile(path.join(process.cwd(), "public", "branding", "atlas-one-logo.jpg")),
    ]).then(([latin, hebrew, logo]) => ({
      latin: latin.toString("base64"),
      hebrew: hebrew.toString("base64"),
      logo: logo.toString("base64"),
    }));
  }
  return assetsPromise;
}

function elementStyle(element: TicketElement) {
  return [
    `left:${element.x}%`, `top:${element.y}%`, `width:${element.width}%`, `height:${element.height}%`,
    `font-size:${Math.max(8, element.fontSize)}px`, `color:${element.color}`,
    `font-weight:${element.bold ? 800 : 400}`, `text-align:${element.align}`,
  ].join(";");
}

function isHebrew(value: string) { return /[\u0590-\u05FF]/.test(value); }

async function renderElement(element: TicketElement, ticket: HtmlTicketInput, qrDataUrl: string) {
  if (element.hidden) return "";
  const data = {
    eventTitle: ticket.eventTitle,
    startsAt: ticket.startsAt,
    venue: ticket.venueName,
    address: [ticket.venueCity, ticket.venueAddress].filter(Boolean).join(", "),
    customerName: ticket.holderName,
    ticketType: ticket.categoryName,
    orderNumber: ticket.orderNumber,
    ticketCode: ticket.ticketCode,
  };
  const style = elementStyle(element);
  if (element.binding === "QR") return `<div class="ticket-element qr" style="${style}"><img src="${qrDataUrl}" alt="QR"></div>`;
  if (element.binding === "IMAGE") return `<div class="ticket-element image" style="${style}"><img src="${esc(safeUrl(element.content))}" alt=""></div>`;
  const value = resolveTicketText(element, data);
  const direction = isHebrew(value) ? "rtl" : "ltr";
  return `<div class="ticket-element text" dir="${direction}" style="${style}"><span>${esc(value)}</span></div>`;
}

async function renderTicket(ticket: HtmlTicketInput, index: number) {
  const design = ticket.design || defaultTicketDesign();
  const qrDataUrl = await QRCode.toDataURL(ticket.ticketCode, { width: 900, margin: 2, errorCorrectionLevel: "Q" });
  const elements = await Promise.all(design.elements.map((element) => renderElement(element, ticket, qrDataUrl)));
  const background = safeUrl(design.backgroundUrl || undefined);
  const customLogo = safeUrl(design.logoUrl || undefined);
  const status = ticket.ticketStatus || "VALID";
  return `<section class="ticket-page${index ? " page-break" : ""}" style="--ticket-bg:${design.backgroundColor};--ticket-accent:${design.accentColor};${background ? `--ticket-image:url('${esc(background)}')` : ""}">
    <div class="ticket-card">
      <div class="accent"></div>
      ${background ? `<div class="background"></div>` : ""}
      <img class="atlas-logo" src="${customLogo ? esc(customLogo) : "data:image/jpeg;base64,__ATLAS_LOGO__"}" alt="Atlas One">
      ${elements.join("")}
      <div class="ticket-status status-${status.toLowerCase()}">${esc(status)}</div>
      <div class="ticket-footer">Powered by Atlas One · atlas-one.co</div>
    </div>
  </section>`;
}

export async function generateTicketHtml(tickets: HtmlTicketInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");
  const assets = await loadAssets();
  const pages = await Promise.all(tickets.map(renderTicket));
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    @font-face{font-family:AtlasSans;src:url(data:font/woff;base64,${assets.latin}) format('woff');font-weight:100 900;font-style:normal;font-display:block}
    @font-face{font-family:AtlasHebrew;src:url(data:font/woff;base64,${assets.hebrew}) format('woff');font-weight:100 900;font-style:normal;font-display:block}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    html,body{margin:0;padding:0;background:#fff;font-family:AtlasSans,Arial,sans-serif}
    .ticket-page{width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#fff;position:relative}
    .page-break{break-before:page;page-break-before:always}
    .ticket-card{position:relative;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:var(--ticket-bg);isolation:isolate}
    .accent{position:absolute;z-index:8;left:0;right:0;top:0;height:6px;background:var(--ticket-accent)}
    .background{position:absolute;z-index:0;inset:0;background-image:linear-gradient(rgba(8,20,38,.30),rgba(8,20,38,.42)),var(--ticket-image);background-size:cover;background-position:center;opacity:.38}
    .atlas-logo{position:absolute;z-index:6;left:28px;top:25px;width:145px;height:54px;object-fit:contain;object-position:left top}
    .ticket-element{position:absolute;z-index:5;overflow:hidden;line-height:1.15;display:flex;align-items:center;padding:1px 2px}
    .ticket-element.text span{display:block;width:100%;overflow-wrap:anywhere;white-space:normal}
    .ticket-element[dir=rtl]{font-family:AtlasHebrew,AtlasSans,Arial,sans-serif}
    .ticket-element.qr{background:#fff;border:1px solid #d8e0ea;padding:7px;border-radius:7px;align-items:center;justify-content:center}
    .ticket-element.qr img{width:100%;height:100%;object-fit:contain;image-rendering:auto}
    .ticket-element.image img{width:100%;height:100%;object-fit:cover}
    .ticket-status{position:absolute;z-index:7;right:24px;top:24px;font-size:9px;font-weight:800;letter-spacing:.8px;padding:5px 9px;border-radius:999px;background:#e8f7ef;color:#167647;border:1px solid #9bd8b5}
    .status-used{background:#fff6e6;color:#a35c00;border-color:#f1c982}.status-cancelled,.status-refunded{background:#fff0f0;color:#b42318;border-color:#f3b1ac}
    .ticket-footer{position:absolute;z-index:7;left:0;right:0;bottom:9px;text-align:center;font-size:8px;color:#667085;letter-spacing:.1px}
    @page{size:${WIDTH}px ${HEIGHT}px;margin:0}
  </style></head><body>${pages.join("")}</body></html>`.replaceAll("__ATLAS_LOGO__", assets.logo);
}
