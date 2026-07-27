import { timingSafeEqual } from "crypto";

const HYP_SIGN_URL = "https://pay.hyp.co.il/p/";

function required(name: "HYP_MASOF" | "HYP_API_KEY" | "HYP_RELAY_URL" | "HYP_API_USER" | "HYP_API_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function safeText(value: string, max = 120) {
  return value.replace(/[<>\r\n]/g, " ").trim().slice(0, max);
}

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function xmlValue(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() || "";
}

function parseSigningResponse(body: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("HYP вернул пустой ответ при создании платёжной ссылки");
  if (/^\s*</.test(trimmed)) throw new Error("HYP вернул HTML/XML вместо подписанной платёжной ссылки. Проверьте HYP_MASOF и HYP_API_KEY в Vercel.");

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    const candidate = [json.paymentUrl, json.url, json.link, json.query].find(value => typeof value === "string") as string | undefined;
    if (candidate) return parseSigningResponse(candidate);
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(json)) if (typeof value === "string" || typeof value === "number") params.set(key, String(value));
    if ([...params.keys()].length) return params;
  } catch { /* not JSON */ }

  if (/^https?:\/\//i.test(trimmed)) {
    const parsed = new URL(trimmed);
    return new URLSearchParams(parsed.searchParams);
  }

  const query = trimmed.replace(/^\?/, "").replace(/^.*?\?/, "");
  return new URLSearchParams(query);
}

function signatureFrom(params: URLSearchParams) {
  return params.get("signature") || params.get("Signature") || params.get("SIGNATURE") || params.get("sign") || params.get("Sign") || "";
}

async function signParameters(parameters: URLSearchParams) {
  const request = new URLSearchParams(parameters);
  for (const key of ["signature", "Signature", "SIGNATURE", "sign", "Sign", "KEY"]) request.delete(key);
  request.set("action", "APISign");
  request.set("What", "SIGN");
  request.set("KEY", required("HYP_API_KEY"));

  const response = await fetch(`${HYP_SIGN_URL}?${request.toString()}`, {
    method: "GET", cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15000),
  });
  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP signing service returned HTTP ${response.status}`);
  if (/error|שגיאה/i.test(body)) throw new Error("HYP отклонил создание платёжной ссылки. Проверьте номер Masof, API key и разрешение APISign в кабинете HYP.");
  return parseSigningResponse(body);
}

export type HypPaymentLinkInput = {
  amountIls: number; orderId: string; description: string; customerName?: string; customerEmail?: string;
  customerPhone?: string; returnUrl: string; language?: "HEB" | "ENG";
};

export async function createHypPaymentLink(input: HypPaymentLinkInput) {
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Invalid payment amount");
  if (!/^https:\/\//i.test(input.returnUrl)) throw new Error("Hyp return URL must use HTTPS");
  const nameParts = safeText(input.customerName || "Atlas Customer", 80).split(/\s+/);
  const firstName = nameParts.shift() || "Atlas";
  const lastName = nameParts.join(" ") || "Customer";
  const paymentParams = new URLSearchParams({
    action: "pay", Masof: required("HYP_MASOF"), Amount: input.amountIls.toFixed(2), Coin: "1",
    Info: safeText(input.description), Order: safeText(input.orderId, 64), ClientName: firstName, ClientLName: lastName,
    email: safeText(input.customerEmail || "payments@atlas-one.co", 120), cell: safeText(input.customerPhone || "", 30),
    PageLang: input.language || "HEB", UTF8: "True", UTF8out: "True", MoreData: "True", Sign: "True",
    Tash: "1", FixTash: "True", sendemail: "False", SendHesh: "False", Postpone: "False", tmp: "1",
    SuccessUrl: input.returnUrl, ErrorUrl: input.returnUrl, ReturnUrl: input.returnUrl,
  });
  const signed = await signParameters(paymentParams);
  const signature = signatureFrom(signed);
  if (!signature) throw new Error("HYP не создал подпись платёжной ссылки. Проверьте в Vercel, что HYP_MASOF и HYP_API_KEY принадлежат одному терминалу и для него включён APISign.");
  signed.delete("KEY"); signed.set("action", "pay");
  return `${HYP_SIGN_URL}?${signed.toString()}`;
}

export async function verifyHypCallback(url: URL) {
  const received = signatureFrom(url.searchParams);
  if (!received) return false;
  const expectedParams = await signParameters(url.searchParams);
  const expected = signatureFrom(expectedParams);
  if (!expected) return false;
  const left = Buffer.from(received); const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function hypResultFromUrl(url: URL) {
  const params = Object.fromEntries(url.searchParams.entries());
  const code = url.searchParams.get("CCode") || url.searchParams.get("code") || url.searchParams.get("errorCode") || "";
  const success = code === "0" || code === "000" || url.searchParams.get("status")?.toLowerCase() === "success";
  return { success, code, orderId: url.searchParams.get("Order") || url.searchParams.get("order") || "",
    transactionId: url.searchParams.get("Id") || url.searchParams.get("TransId") || url.searchParams.get("ACode") || url.searchParams.get("txId") || "",
    amount: url.searchParams.get("Amount") || url.searchParams.get("amount") || "",
    cardMask: url.searchParams.get("L4digit") || url.searchParams.get("cardMask") || "", raw: params };
}

export async function refundHypDeal(input: { transactionId: string; amountMinor?: number }) {
  if (!input.transactionId.trim()) throw new Error("Не найден идентификатор транзакции HYP");
  if (input.amountMinor !== undefined && (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)) throw new Error("Некорректная сумма возврата");
  const total = input.amountMinor === undefined ? "" : `<total>${input.amountMinor}</total><numberOfPayments>1</numberOfPayments>`;
  const xml = `<ashrait><request><version>2000</version><language>ENG</language><command>refundDeal</command><refundDeal><terminalNumber>${escapeXml(required("HYP_MASOF"))}</terminalNumber><tranId>${escapeXml(input.transactionId)}</tranId>${total}</refundDeal></request></ashrait>`;
  const response = await fetch(required("HYP_RELAY_URL"), {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ user: required("HYP_API_USER"), password: required("HYP_API_PASSWORD"), int_in: xml }),
    cache: "no-store", signal: AbortSignal.timeout(30000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`HYP вернул HTTP ${response.status}`);
  const code = xmlValue(body, "result");
  const message = xmlValue(body, "userMessage") || xmlValue(body, "message") || "Неизвестный ответ HYP";
  const refundTransactionId = xmlValue(body, "tranId");
  if (code !== "000") throw new Error(`HYP: ${message} (${code || "без кода"})`);
  return { code, message, transactionId: refundTransactionId };
}
