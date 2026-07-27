import { timingSafeEqual } from "crypto";

function required(name: "HYP_MASOF" | "HYP_MID" | "HYP_RELAY_URL" | "HYP_API_USER" | "HYP_API_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function safeText(value: string, max = 120) {
  return value.replace(/[<>\r\n]/g, " ").trim().slice(0, max);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function xmlValue(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() || "";
}

async function relay(xml: string) {
  const response = await fetch(required("HYP_RELAY_URL"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      user: required("HYP_API_USER"),
      password: required("HYP_API_PASSWORD"),
      int_in: xml,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HYP вернул HTTP ${response.status}`);
  return body;
}

export type HypPaymentLinkInput = {
  amountIls: number;
  orderId: string;
  description: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl: string;
  language?: "HEB" | "ENG";
};

export async function createHypPaymentLink(input: HypPaymentLinkInput) {
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Invalid payment amount");
  if (!/^https:\/\//i.test(input.returnUrl)) throw new Error("Hyp return URL must use HTTPS");

  const totalMinor = Math.round(input.amountIls * 100);
  const uniqueId = safeText(input.orderId, 64);
  const language = input.language || "HEB";
  const xml = `<ashrait><request><version>2000</version><language>${language}</language><command>doDeal</command><doDeal><terminalNumber>${escapeXml(required("HYP_MASOF"))}</terminalNumber><cardNo>CGMPI</cardNo><total>${totalMinor}</total><transactionType>Debit</transactionType><creditType>RegularCredit</creditType><currency>ILS</currency><transactionCode>Internet</transactionCode><validation>TxnSetup</validation><mid>${escapeXml(required("HYP_MID"))}</mid><uniqueid>${escapeXml(uniqueId)}</uniqueid><mpiValidation>AutoComm</mpiValidation><successUrl>${escapeXml(input.returnUrl)}</successUrl><errorUrl>${escapeXml(input.returnUrl)}</errorUrl><cancelUrl>${escapeXml(input.returnUrl)}</cancelUrl><email>${escapeXml(safeText(input.customerEmail || "", 120))}</email><customerData>${escapeXml(safeText(input.description, 120))}</customerData></doDeal></request></ashrait>`;

  const body = await relay(xml);
  const code = xmlValue(body, "result") || xmlValue(body, "status");
  const message = xmlValue(body, "userMessage") || xmlValue(body, "message") || xmlValue(body, "statusText");
  const paymentUrl = xmlValue(body, "mpiHostedPageUrl").replace(/&amp;/g, "&");
  if (code !== "000" || !paymentUrl) {
    throw new Error(`HYP не создал платёжную страницу: ${message || "неизвестная ошибка"}${code ? ` (${code})` : ""}`);
  }
  return paymentUrl;
}

export async function verifyHypCallback(url: URL) {
  const received = url.searchParams.get("responseMac") || "";
  const password = process.env.HYP_MERCHANT_PASSWORD?.trim() || "";
  if (!received || !password) return false;
  const source = [
    password,
    url.searchParams.get("txId") || "",
    url.searchParams.get("errorCode") || "000",
    url.searchParams.get("cardToken") || "",
    url.searchParams.get("cardExp") || "",
    url.searchParams.get("personalId") || "",
    url.searchParams.get("uniqueId") || url.searchParams.get("uniqueid") || "",
  ].join("");
  const expected = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source))).toString("base64");
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hypResultFromUrl(url: URL) {
  const params = Object.fromEntries(url.searchParams.entries());
  const code = url.searchParams.get("errorCode") || url.searchParams.get("CCode") || url.searchParams.get("code") || "";
  const success = code === "0" || code === "000" || url.searchParams.get("status")?.toLowerCase() === "success";
  return {
    success,
    code,
    orderId: url.searchParams.get("uniqueId") || url.searchParams.get("uniqueid") || url.searchParams.get("Order") || url.searchParams.get("order") || "",
    transactionId: url.searchParams.get("txId") || url.searchParams.get("tranId") || url.searchParams.get("Id") || url.searchParams.get("TransId") || url.searchParams.get("cgUid") || "",
    amount: url.searchParams.get("total") || url.searchParams.get("Amount") || url.searchParams.get("amount") || "",
    cardMask: url.searchParams.get("cardMask") || url.searchParams.get("L4digit") || "",
    raw: params,
  };
}

export async function refundHypDeal(input: { transactionId: string; amountMinor?: number }) {
  if (!input.transactionId.trim()) throw new Error("Не найден идентификатор транзакции HYP");
  if (input.amountMinor !== undefined && (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)) throw new Error("Некорректная сумма возврата");
  const total = input.amountMinor === undefined ? "" : `<total>${input.amountMinor}</total><numberOfPayments>1</numberOfPayments>`;
  const xml = `<ashrait><request><version>2000</version><language>ENG</language><command>refundDeal</command><refundDeal><terminalNumber>${escapeXml(required("HYP_MASOF"))}</terminalNumber><tranId>${escapeXml(input.transactionId)}</tranId>${total}</refundDeal></request></ashrait>`;
  const body = await relay(xml);
  const code = xmlValue(body, "result");
  const message = xmlValue(body, "userMessage") || xmlValue(body, "message") || "Неизвестный ответ HYP";
  const refundTransactionId = xmlValue(body, "tranId");
  if (code !== "000") throw new Error(`HYP: ${message} (${code || "без кода"})`);
  return { code, message, transactionId: refundTransactionId };
}
