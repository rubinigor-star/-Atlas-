import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import type { TicketDesign } from "@/lib/ticket-template";
import { generateTicketHtml } from "@/lib/ticket-html";

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

export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");

  const html = await generateTicketHtml(tickets);
  chromium.setGraphicsMode = false;
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 420, height: 680, deviceScaleFactor: 2 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
    await page.emulateMediaType("screen");
    await page.evaluate(async () => {
      await document.fonts.ready;
      const images = Array.from(document.images);
      await Promise.all(images.map((image) => image.complete ? Promise.resolve() : new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      })));
    });
    const bytes = await page.pdf({
      printBackground: true,
      width: "420px",
      height: "680px",
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      preferCSSPageSize: true,
      tagged: true,
    });
    if (bytes.length < 10_000) throw new Error(`Chromium вернул подозрительно маленький PDF: ${bytes.length} байт`);
    return Buffer.from(bytes);
  } finally {
    await browser.close();
  }
}
