import { stat } from "node:fs/promises";
import chromium from "@sparticuz/chromium";
import puppeteer, { type Browser } from "puppeteer-core";
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
let executablePathPromise: Promise<string> | null = null;

async function waitForStableExecutable(executablePath: string) {
  let previousSize = -1;
  let stableChecks = 0;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const file = await stat(executablePath);
      if (file.size > 0 && file.size === previousSize) {
        stableChecks += 1;
        if (stableChecks >= 3) return;
      } else {
        stableChecks = 0;
        previousSize = file.size;
      }
    } catch {
      stableChecks = 0;
    }
    await sleep(250);
  }

  throw new Error("Chromium executable did not become stable in time");
}

async function getExecutablePath() {
  executablePathPromise ??= (async () => {
    const executablePath = await chromium.executablePath();
    await waitForStableExecutable(executablePath);
    return executablePath;
  })().catch(error => {
    executablePathPromise = null;
    throw error;
  });

  return executablePathPromise;
}

async function launchBrowser(): Promise<Browser> {
  let lastError: unknown;
  const retryDelays = [0, 1000, 2000, 4000];

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt] > 0) await sleep(retryDelays[attempt]);

    try {
      const executablePath = await getExecutablePath();
      return await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 420, height: 680, deviceScaleFactor: 2 },
        executablePath,
        headless: true,
      });
    } catch (error) {
      lastError = error;
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "ETXTBSY" || attempt === retryDelays.length - 1) throw error;
      console.warn("[ticket-pdf] Chromium executable busy after cold start, retrying", {
        attempt: attempt + 1,
        nextDelayMs: retryDelays[attempt + 1],
      });
      executablePathPromise = null;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Не удалось запустить Chromium");
}

export async function generateTicketPdf(tickets: TicketPdfInput[]) {
  if (!tickets.length) throw new Error("Для генерации PDF не переданы билеты");

  const html = await generateTicketHtml(tickets);
  chromium.setGraphicsMode = false;
  const browser = await launchBrowser();

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
