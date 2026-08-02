import QRCode from "qrcode";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TicketDesign, TicketElement } from "@/lib/ticket-template";
import { defaultTicketDesign } from "@/lib/ticket-template";
import { getTicketLocale, localizedStatus, resolveLocalizedTicketText } from "@/lib/ticket-language";

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
let assetsPromise: Promise<{ latin: string; hebrew: string }> | null = null;

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
    ]).then(([latin, hebrew]) => ({ latin: latin.toString("base64"), hebrew: hebrew.toString("base64") }));
  }
  return assetsPromise;
}

function atlasWordmark(accentColor: string) {
  return `<div class="atlas-brand" aria-label="Atlas One"><span class="atlas-mark"><span class="atlas-a">A</span><span class="atlas-dot" style="background:${esc(accentColor)}"></span></span><span class="atlas-word">ATLAS <b style="color:${esc(accentColor)}">ONE</b></span></div>`;
}

function elementStyle(element: TicketElement) {
  return [
    `left:${element.x}%`, `top:${element.y}%`, `width:${element.width}%`, `height:${element.height}%`,
    `font-size:${Math.max(8, element.fontSize)}px`, `color:${element.color}`,
    `font-weight:${element.bold ? 800 : 400}`, `text-align:${element.align}`,
  ].join(";");
}

function isHebrew(value: string) { return /[\u0590-\u05FF]/.test(value); }

async function renderElement(element: TicketElement, ticket: HtmlTicketInput, qrDataUrl: string, locale: ReturnType<typeof getTicketLocale>) {
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
  const value = resolveLocalizedTicketText(element, data, locale);
  const direction = isHebrew(value) ? "rtl" : "ltr";
  const fitClass = element.binding === "EVENT_TITLE" ? " event-title" : "";
  return `<div class="ticket-element text${fitClass}" dir="${direction}" style="${style}"><span>${esc(value)}</span></div>`;
}

async function renderTicket(ticket: HtmlTicketInput, index: number) {
  const design = ticket.design || defaultTicketDesign();
  const locale = getTicketLocale(design);
  const qrDataUrl = await QRCode.toDataURL(ticket.ticketCode, { width: 900, margin: 2, errorCorrectionLevel: "Q" });
  const elements = await Promise.all(design.elements.map((element) => renderElement(element, ticket, qrDataUrl, locale)));
  const background = safeUrl(design.backgroundUrl || undefined);
  const customLogo = safeUrl(design.logoUrl || undefined);
  const status = ticket.ticketStatus || "VALID";
  return `<section class="ticket-page${index ? " page-break" : ""}" dir="${locale === "he" ? "rtl" : "ltr"}" lang="${locale}" style="--ticket-bg:${design.backgroundColor};--ticket-accent:${design.accentColor};${background ? `--ticket-image:url('${esc(background)}')` : ""}">
    <div class="ticket-card">
      <div class="accent"></div>
      ${background ? `<div class="background"></div>` : ""}
      ${customLogo ? `<img class="custom-logo" src="${esc(customLogo)}" alt="Atlas One">` : atlasWordmark(design.accentColor)}
      ${elements.join("")}
      <div class="ticket-status status-${status.toLowerCase()}">${esc(localizedStatus(status, locale))}</div>
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
    .atlas-brand{position:absolute;z-index:7;left:27px;top:22px;display:flex;align-items:center;gap:9px;height:43px;color:inherit;direction:ltr}
    .atlas-mark{position:relative;width:40px;height:40px;border-radius:12px;background:#081426;display:grid;place-items:center;box-shadow:0 0 0 1px rgba(255,255,255,.18)}
    .atlas-a{font-size:24px;line-height:1;font-weight:900;color:#fff;letter-spacing:-.08em;transform:translateX(-1px)}
    .atlas-dot{position:absolute;right:4px;top:4px;width:8px;height:8px;border-radius:50%}
    .atlas-word{font-size:17px;font-weight:900;letter-spacing:-.04em;white-space:nowrap;color:inherit}
    .custom-logo{position:absolute;z-index:7;left:27px;top:22px;width:150px;height:44px;object-fit:contain;object-position:left center}
    .ticket-element{position:absolute;z-index:5;overflow:hidden;line-height:1.15;display:flex;align-items:center;padding:1px 2px}
    .ticket-element.text span{display:block;width:100%;overflow-wrap:anywhere;white-space:normal}
    .ticket-element[dir=rtl]{font-family:AtlasHebrew,AtlasSans,Arial,sans-serif}
    .ticket-element.qr{background:#fff;border:1px solid #d8e0ea;padding:7px;border-radius:7px;align-items:center;justify-content:center}
    .ticket-element.qr img{width:100%;height:100%;object-fit:contain;image-rendering:auto}
    .ticket-element.image img{width:100%;height:100%;object-fit:cover}
    .ticket-status{position:absolute;z-index:7;right:24px;top:24px;font-size:9px;font-weight:800;letter-spacing:.8px;padding:5px 9px;border-radius:999px;background:#e8f7ef;color:#167647;border:1px solid #9bd8b5}
    .ticket-page[dir=rtl] .ticket-status{right:auto;left:24px}.ticket-page[dir=rtl] .atlas-brand,.ticket-page[dir=rtl] .custom-logo{left:auto;right:27px}
    .status-used{background:#fff6e6;color:#a35c00;border-color:#f1c982}.status-cancelled,.status-refunded{background:#fff0f0;color:#b42318;border-color:#f3b1ac}
    .ticket-footer{position:absolute;z-index:7;left:0;right:0;bottom:9px;text-align:center;font-size:8px;color:#667085;letter-spacing:.1px;direction:ltr}
    @page{size:${WIDTH}px ${HEIGHT}px;margin:0}
  </style></head><body>${pages.join("")}<script>
    (()=>{for(const box of document.querySelectorAll('.event-title')){const span=box.querySelector('span');if(!span)continue;let size=parseFloat(getComputedStyle(box).fontSize)||28;const min=12;while(size>min&&(span.scrollHeight>box.clientHeight||span.scrollWidth>box.clientWidth)){size-=1;box.style.fontSize=size+'px';}}})();
  </script></body></html>`;
}
