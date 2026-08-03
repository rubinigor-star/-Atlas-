const HYP_ENDPOINT = "https://pay.hyp.co.il/p/";
const DEFAULT_RELAY_ENDPOINT = "https://icom.yaad.net/xpo/Relay";
const REQUEST_TIMEOUT_MS = 20_000;

type RequiredEnv = "HYP_MASOF" | "HYP_API_KEY" | "HYP_PASSP";

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

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function xmlValue(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}

function assertHttps(value: string, label: string) {
  if (!/^https:\/\//i.test(value)) throw new Error(`${label} must use HTTPS`);
}

export function roundToWholeIlsMinor(minor: number) {
  if (!Number.isFinite(minor)) throw new Error("Некорректная сумма");
  return Math.round(minor / 100) * 100;
}

function deploymentOrigin() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}

function normalizeCallbackUrl(value: string) {
  assertHttps(value, "HYP return URL");
  const url = new URL(value);
  const origin = deploymentOrigin();
  return `${origin}${url.pathname}${url.search}`;
}

function parseHypBody(body: string) {
  return new URLSearchParams(body.trim().replace(/^\?/, ""));
}

function redact(params: URLSearchParams) {
  const safe = new URLSearchParams(params);
  for (const key of ["KEY", "PassP", "password", "signature"]) {
    if (safe.has(key)) safe.set(key, "[REDACTED]");
  }
  return safe.toString();
}

async function callApiSign(what: "SIGN" | "VERIFY", paymentParams: URLSearchParams) {
  const requestParams = new URLSearchParams();
  requestParams.set("action", "APISign");
  requestParams.set("What", what);
  requestParams.set("KEY", required("HYP_API_KEY"));
  requestParams.set("PassP", required("HYP_PASSP"));
  requestParams.set("Masof", required("HYP_MASOF"));

  for (const [key, value] of paymentParams.entries()) {
    if (!["action", "What", "KEY", "PassP", "Masof"].includes(key)) {
      requestParams.append(key, value);
    }
  }

  console.info("hyp.apisign.request", {
    what,
    endpoint: HYP_ENDPOINT,
    params: redact(requestParams),
  });

  const response = await fetch(`${HYP_ENDPOINT}?${requestParams.toString()}`, {
    method: "GET",
    headers: {
      "User-Agent": "Atlas-One-HYP/1.0",
      Accept: "text/plain, application/x-www-form-urlencoded, */*",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP APISign HTTP ${response.status}`);
  if (!body) throw new Error("HYP APISign returned an empty response");

  const result = parseHypBody(body);
  const errorCode = result.get("CCode") || result.get("Error") || result.get("error") || "";
  if (errorCode && errorCode !== "0" && errorCode !== "000") {
    throw new Error(`HYP APISign ${errorCode}: ${result.get("ErrMsg") || result.get("Message") || "request rejected"}`);
  }

  console.info("hyp.apisign.response", {
    what,
    keys: Array.from(result.keys()),
    hasSignature: Boolean(result.get("signature")),
    action: result.get("action") || "",
    masof: result.get("Masof") || "",
  });

  return result;
}

async function callRelay(xml: string) {
  const endpoint = optional("HYP_RELAY_URL") || DEFAULT_RELAY_ENDPOINT;
  assertHttps(endpoint, "HYP Relay URL");

  const form = new URLSearchParams({
    user: required("HYP_API_KEY"),
    password: required("HYP_PASSP"),
    int_in: xml,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/xml, text/xml, text/plain, */*",
      "User-Agent": "Atlas-One-HYP/1.0",
    },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP Relay HTTP ${response.status}`);
  if (!body) throw new Error("HYP Relay returned an empty response");
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
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Некорректная сумма оплаты");

  const callbackUrl = normalizeCallbackUrl(input.returnUrl);
  const orderId = safeText(input.orderId, 64);
  if (!orderId) throw new Error("HYP order ID is required");

  const requestedMinor = Math.round(input.amountIls * 100);
  const chargedMinor = roundToWholeIlsMinor(requestedMinor);
  if (chargedMinor <= 0) throw new Error("Сумма после округления должна быть не меньше 1 ₪");
  const chargedIls = chargedMinor / 100;

  const nameParts = safeText(input.customerName || "Atlas Customer", 100).split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || "Atlas";
  const lastName = nameParts.join(" ") || "Customer";

  const paymentParams = new URLSearchParams({
    action: "pay",
    Masof: required("HYP_MASOF"),
    Amount: chargedIls.toFixed(2),
    Coin: "1",
    Info: safeText(input.description, 120),
    Order: orderId,
    ClientName: firstName,
    ClientLName: lastName,
    email: safeText(input.customerEmail || "", 120),
    cell: safeText(input.customerPhone || "", 30),
    phone: safeText(input.customerPhone || "", 30),
    PageLang: input.language || "HEB",
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
    ReturnUrl: callbackUrl,
    SuccessUrl: callbackUrl,
    ErrorUrl: callbackUrl,
    CancelUrl: callbackUrl,
  });

  const signed = await callApiSign("SIGN", paymentParams);
  if (signed.get("action") !== "pay") throw new Error("HYP APISign response does not contain action=pay");
  if (!signed.get("signature")) throw new Error("HYP APISign response does not contain signature");

  const paymentUrl = `${HYP_ENDPOINT}?${signed.toString()}`;
  assertHttps(paymentUrl, "HYP payment page URL");

  console.info("hyp.payment_page.created", {
    orderId,
    requestedMinor,
    chargedMinor,
    masof: signed.get("Masof") || required("HYP_MASOF"),
    callbackUrl,
  });

  return paymentUrl;
}

export function hypResultFromUrl(url: URL) {
  const raw = Object.fromEntries(url.searchParams.entries());
  const code = url.searchParams.get("CCode") || url.searchParams.get("code") || url.searchParams.get("errorCode") || "";
  const success = code === "0" || code === "000";

  return {
    success,
    code,
    orderId: url.searchParams.get("Order") || url.searchParams.get("order") || "",
    transactionId:
      url.searchParams.get("Id") ||
      url.searchParams.get("TransId") ||
      url.searchParams.get("ACode") ||
      url.searchParams.get("txId") ||
      "",
    cgUid: url.searchParams.get("cgUid") || url.searchParams.get("UID") || "",
    tranId: url.searchParams.get("TransId") || url.searchParams.get("tranId") || "",
    txId: url.searchParams.get("txId") || "",
    amount: url.searchParams.get("Amount") || url.searchParams.get("amount") || "",
    cardMask: url.searchParams.get("L4digit") || url.searchParams.get("cardMask") || "",
    raw,
  };
}

export async function verifyHypCallback(url: URL) {
  const result = hypResultFromUrl(url);
  if (!result.success || !result.orderId) return false;

  try {
    const verified = await callApiSign("VERIFY", new URLSearchParams(url.searchParams));
    const verifiedCode = verified.get("CCode") || verified.get("code") || "";
    const ok = verifiedCode === "0" || verifiedCode === "000";

    console.info("hyp.callback.verified", {
      orderId: result.orderId,
      verifiedCode,
      verified: ok,
    });

    return ok;
  } catch (error) {
    console.error("hyp.callback.verification_failed", {
      orderId: result.orderId,
      message: error instanceof Error ? error.message : "Unknown verification error",
    });
    return false;
  }
}

export async function refundHypDeal(input: { transactionId: string; amountMinor?: number }) {
  const transactionId = safeText(input.transactionId, 80);
  if (!transactionId) throw new Error("Не найден идентификатор исходной транзакции HYP");
  if (input.amountMinor !== undefined && (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)) {
    throw new Error("Некорректная сумма возврата");
  }

  const amountXml = input.amountMinor === undefined ? "" : `<total>${input.amountMinor}</total>`;
  const xml = `<ashrait><request><version>2000</version><language>Eng</language><command>refundDeal</command><refundDeal><terminalNumber>${xmlEscape(required("HYP_MASOF"))}</terminalNumber><tranId>${xmlEscape(transactionId)}</tranId>${amountXml}</refundDeal></request></ashrait>`;
  const responseXml = await callRelay(xml);
  const result = xmlValue(responseXml, "result") || xmlValue(responseXml, "status");
  const status = xmlValue(responseXml, "status") || result;
  const message = xmlValue(responseXml, "userMessage") || xmlValue(responseXml, "message") || xmlValue(responseXml, "statusText");
  const refundTransactionId = xmlValue(responseXml, "tranId");

  if (result !== "000" || (status && status !== "000")) {
    throw new Error(`HYP refund ${result || status || "UNKNOWN"}: ${message || "request rejected"}`);
  }
  if (!refundTransactionId) throw new Error("HYP подтвердил возврат без идентификатора транзакции");

  console.info("hyp.refund.succeeded", {
    originalTransactionId: transactionId,
    refundTransactionId,
    amountMinor: input.amountMinor ?? null,
  });

  return {
    transactionId: refundTransactionId,
    result,
    message,
  };
}
