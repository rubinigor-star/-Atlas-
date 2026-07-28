import { createHmac } from "crypto";

const HYP_ENDPOINT = "https://pay.hyp.co.il/p/";
const REQUEST_TIMEOUT_MS = 15_000;

type RequiredEnv = "HYP_MASOF" | "HYP_API_KEY";

function required(name: RequiredEnv) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function optional(name: string) {
  return process.env[name]?.trim() || "";
}

function safeText(value: string, max = 120) {
  return value.replace(/[<>\r\n]/g, " ").trim().slice(0, max);
}

function encode(value: string) {
  return encodeURIComponent(value)
    .replace(/!/g, "%21")
    .replace(/'/g, "%27")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/\*/g, "%2A");
}

function signedQuery(params: Record<string, string>) {
  const entries = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([left], [right]) => left.localeCompare(right));
  const query = entries.map(([key, value]) => `${encode(key)}=${encode(value)}`).join("&");
  const signature = createHmac("sha256", required("HYP_API_KEY")).update(query).digest("hex");
  return `${query}&signature=${signature}`;
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
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Некорректная сумма оплаты");
  if (!/^https:\/\//i.test(input.returnUrl)) throw new Error("Адрес возврата HYP должен использовать HTTPS");

  const nameParts = safeText(input.customerName || "Atlas Customer", 100).split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || "Atlas";
  const lastName = nameParts.join(" ") || "Customer";
  const language = input.language || "HEB";
  const passP = optional("HYP_PASSP");

  const params: Record<string, string> = {
    action: "pay",
    Masof: required("HYP_MASOF"),
    PassP: passP,
    Amount: input.amountIls.toFixed(2),
    Coin: "1",
    Info: safeText(input.description, 120),
    Order: safeText(input.orderId, 64),
    ClientName: firstName,
    ClientLName: lastName,
    email: safeText(input.customerEmail || "", 120),
    cell: safeText(input.customerPhone || "", 30),
    phone: safeText(input.customerPhone || "", 30),
    PageLang: language,
    UTF8: "True",
    UTF8out: "True",
    MoreData: "True",
    Sign: "True",
    Tash: "1",
    FixTash: "True",
    sendemail: "False",
    SendHesh: "False",
    Postpone: "False",
    J5: "False",
    tmp: optional("HYP_TEMPLATE") || "1",
    SuccessUrl: input.returnUrl,
    ErrorUrl: input.returnUrl,
    CancelUrl: input.returnUrl,
  };

  return `${HYP_ENDPOINT}?${signedQuery(params)}`;
}

function hypHeaders() {
  const origin = "https://www.atlas-one.co";
  return { Referer: `${origin}/`, Origin: origin, "User-Agent": "Atlas-One/1.0" };
}

export async function verifyHypCallback(url: URL) {
  const params = new URLSearchParams();
  params.set("action", "APISign");
  params.set("What", "VERIFY");
  params.set("KEY", required("HYP_API_KEY"));
  params.set("Masof", required("HYP_MASOF"));
  const passP = optional("HYP_PASSP");
  if (passP) params.set("PassP", passP);
  for (const [key, value] of url.searchParams.entries()) {
    if (!["action", "What", "KEY", "Masof", "PassP"].includes(key)) params.append(key, value);
  }

  try {
    const response = await fetch(`${HYP_ENDPOINT}?${params.toString()}`, {
      method: "GET",
      headers: hypHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return false;
    const body = (await response.text()).trim();
    const verified = new URLSearchParams(body.replace(/^\?/, ""));
    return verified.get("CCode") === "0" || verified.get("CCode") === "000";
  } catch {
    return false;
  }
}

export function hypResultFromUrl(url: URL) {
  const params = Object.fromEntries(url.searchParams.entries());
  const code = url.searchParams.get("CCode") || url.searchParams.get("code") || url.searchParams.get("errorCode") || "";
  const success = code === "0" || code === "000" || url.searchParams.get("status")?.toLowerCase() === "success";
  return {
    success,
    code,
    orderId: url.searchParams.get("Order") || url.searchParams.get("order") || url.searchParams.get("uniqueId") || "",
    transactionId: url.searchParams.get("Id") || url.searchParams.get("TransId") || url.searchParams.get("ACode") || url.searchParams.get("txId") || "",
    amount: url.searchParams.get("Amount") || url.searchParams.get("amount") || url.searchParams.get("total") || "",
    cardMask: url.searchParams.get("L4digit") || url.searchParams.get("cardMask") || "",
    raw: params,
  };
}

export async function refundHypDeal(input: { transactionId: string; amountMinor?: number }) {
  if (!input.transactionId.trim()) throw new Error("Не найден идентификатор транзакции HYP");
  const passP = optional("HYP_PASSP");
  if (!passP) throw new Error("HYP_PASSP is not configured");

  const params = new URLSearchParams({
    action: "CancelTrans",
    Masof: required("HYP_MASOF"),
    PassP: passP,
    TransId: input.transactionId.trim(),
  });
  const response = await fetch(`${HYP_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: hypHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await response.text()).trim();
  const result = new URLSearchParams(body.replace(/^\?/, ""));
  const code = result.get("CCode") || "";
  if (!response.ok || (code !== "0" && code !== "000")) {
    throw new Error(`HYP: возврат не выполнен (${code || response.status})`);
  }
  return { code, message: "Refund accepted", transactionId: result.get("Id") || input.transactionId };
}
