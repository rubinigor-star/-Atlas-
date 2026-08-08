const HYP_ENDPOINT = "https://pay.hyp.co.il/p/";
const REQUEST_TIMEOUT_MS = 20_000;

type RequiredEnv = "HYP_MASOF" | "HYP_API_KEY" | "HYP_PASSP";

function required(name: RequiredEnv) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}
function optional(name: string) { return process.env[name]?.trim() || ""; }
function safeText(value: string, max = 120) { return value.replace(/[<>\r\n]/g, " ").trim().slice(0, max); }
function assertHttps(value: string, label: string) { if (!/^https:\/\//i.test(value)) throw new Error(`${label} must use HTTPS`); }
function deploymentOrigin() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}
function normalizeCallbackUrl(value: string) {
  assertHttps(value, "HYP return URL");
  const url = new URL(value);
  return `${deploymentOrigin()}${url.pathname}${url.search}`;
}
function parseHypBody(body: string) {
  const trimmed = body.trim();
  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    return new URLSearchParams(Object.entries(json).map(([key, value]) => [key, value == null ? "" : String(value)]));
  } catch {
    return new URLSearchParams(trimmed.replace(/^\?/, ""));
  }
}
function redact(params: URLSearchParams) {
  const safe = new URLSearchParams(params);
  for (const key of ["KEY", "PassP", "signature"]) if (safe.has(key)) safe.set(key, "[REDACTED]");
  return safe.toString();
}
function safeResponse(value: string) {
  return value.replace(/(PassP=)[^&\s]+/gi, "$1[REDACTED]").replace(/("?PassP"?\s*[:=]\s*")[^"]+/gi, "$1[REDACTED]").slice(0, 20_000);
}
function first(params: URLSearchParams, names: string[]) {
  for (const name of names) { const value = params.get(name); if (value) return value; }
  return "";
}

async function callApiSign(what: "SIGN" | "VERIFY", paymentParams: URLSearchParams) {
  const requestParams = new URLSearchParams({ action: "APISign", What: what, KEY: required("HYP_API_KEY"), PassP: required("HYP_PASSP"), Masof: required("HYP_MASOF") });
  for (const [key, value] of paymentParams.entries()) if (!["action", "What", "KEY", "PassP", "Masof"].includes(key)) requestParams.append(key, value);
  console.info("hyp.apisign.request", { what, endpoint: HYP_ENDPOINT, params: redact(requestParams) });
  const response = await fetch(`${HYP_ENDPOINT}?${requestParams.toString()}`, { method: "GET", headers: { "User-Agent": "Atlas-One-HYP/1.0", Accept: "text/plain, application/x-www-form-urlencoded, */*" }, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP APISign HTTP ${response.status}`);
  if (!body) throw new Error("HYP APISign returned an empty response");
  const result = parseHypBody(body);
  const errorCode = result.get("CCode") || result.get("Error") || result.get("error") || "";
  if (errorCode && errorCode !== "0" && errorCode !== "000") throw new Error(`HYP APISign ${errorCode}: ${result.get("ErrMsg") || result.get("Message") || "request rejected"}`);
  console.info("hyp.apisign.response", { what, keys: Array.from(result.keys()), hasSignature: Boolean(result.get("signature")), action: result.get("action") || "", masof: result.get("Masof") || "" });
  return result;
}

export type HypPaymentLinkInput = { amountIls: number; orderId: string; description: string; customerName?: string; customerEmail?: string; customerPhone?: string; returnUrl: string; language?: "HEB" | "ENG" };

export async function createHypPaymentLink(input: HypPaymentLinkInput) {
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Некорректная сумма оплаты");
  const callbackUrl = normalizeCallbackUrl(input.returnUrl);
  const orderId = safeText(input.orderId, 64);
  if (!orderId) throw new Error("HYP order ID is required");
  const nameParts = safeText(input.customerName || "Atlas Customer", 100).split(/\s+/).filter(Boolean);
  const firstName = nameParts.shift() || "Atlas";
  const lastName = nameParts.join(" ") || "Customer";
  const paymentParams = new URLSearchParams({ action: "pay", Masof: required("HYP_MASOF"), Amount: input.amountIls.toFixed(2), Coin: "1", Info: safeText(input.description, 120), Order: orderId, ClientName: firstName, ClientLName: lastName, email: safeText(input.customerEmail || "", 120), cell: safeText(input.customerPhone || "", 30), phone: safeText(input.customerPhone || "", 30), PageLang: input.language || "HEB", UTF8: "True", UTF8out: "True", MoreData: "True", Sign: "True", Tash: "1", FixTash: "True", sendemail: "False", SendHesh: "False", Postpone: "False", J5: "False", tmp: optional("HYP_TEMPLATE") || "1", ReturnUrl: callbackUrl, SuccessUrl: callbackUrl, ErrorUrl: callbackUrl, CancelUrl: callbackUrl });
  const signed = await callApiSign("SIGN", paymentParams);
  if (signed.get("action") !== "pay") throw new Error("HYP APISign response does not contain action=pay");
  if (!signed.get("signature")) throw new Error("HYP APISign response does not contain signature");
  const paymentUrl = `${HYP_ENDPOINT}?${signed.toString()}`;
  assertHttps(paymentUrl, "HYP payment page URL");
  console.info("hyp.payment_page.created", { orderId, amount: input.amountIls.toFixed(2), masof: signed.get("Masof") || required("HYP_MASOF"), callbackUrl });
  return paymentUrl;
}

export function hypResultFromUrl(url: URL) {
  const raw = Object.fromEntries(url.searchParams.entries());
  const code = url.searchParams.get("CCode") || url.searchParams.get("code") || url.searchParams.get("errorCode") || "";
  const id = url.searchParams.get("Id") || "";
  const transId = url.searchParams.get("TransId") || url.searchParams.get("tranId") || id;
  return {
    success: code === "0" || code === "000",
    code,
    orderId: url.searchParams.get("Order") || url.searchParams.get("order") || url.searchParams.get("uniqueId") || url.searchParams.get("uniqueID") || "",
    transId,
    transactionId: transId,
    cgUid: url.searchParams.get("cgUid") || "",
    txId: url.searchParams.get("txId") || "",
    uniqueId: url.searchParams.get("uniqueId") || url.searchParams.get("uniqueID") || "",
    authorizationCode: url.searchParams.get("ACode") || url.searchParams.get("authNumber") || "",
    id,
    amount: url.searchParams.get("Amount") || url.searchParams.get("amount") || url.searchParams.get("total") || "",
    cardMask: url.searchParams.get("L4digit") || url.searchParams.get("cardMask") || "",
    cardToken: url.searchParams.get("cardToken") || url.searchParams.get("CardToken") || url.searchParams.get("Token") || "",
    cardExp: url.searchParams.get("cardExp") || url.searchParams.get("CardExp") || url.searchParams.get("Tokef") || "",
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
    console.info("hyp.callback.verified", { orderId: result.orderId, verifiedCode, verified: ok });
    return ok;
  } catch (error) {
    console.error("hyp.callback.verification_failed", { orderId: result.orderId, message: error instanceof Error ? error.message : "Unknown verification error" });
    return false;
  }
}

export type HypRefundResult = { resultCode: string; refundTranId: string; statusText: string; rawResponse: string };

export async function refundHypDeal(input: { transactionId: string; amountMinor: number }): Promise<HypRefundResult> {
  const transactionId = input.transactionId.trim();
  if (!/^\d+$/.test(transactionId)) throw new Error("Не найден идентификатор исходной транзакции HYP");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Некорректная сумма возврата");
  const params = new URLSearchParams({ action: "zikoyAPI", Masof: required("HYP_MASOF"), PassP: required("HYP_PASSP"), TransId: transactionId, Amount: (input.amountMinor / 100).toFixed(2) });
  console.info("hyp.refund.request", { endpoint: HYP_ENDPOINT, params: redact(params) });
  const response = await fetch(`${HYP_ENDPOINT}?${params.toString()}`, { method: "GET", headers: { "User-Agent": "Atlas-One-HYP-Refunds/1.0", Accept: "text/plain, application/x-www-form-urlencoded, application/json, */*" }, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP zikoyAPI HTTP ${response.status}: ${safeResponse(body).slice(0, 300)}`);
  if (!body) throw new Error("HYP вернул пустой ответ на возврат");
  const result = parseHypBody(body);
  const resultCode = first(result, ["CCode", "Code", "code", "Error", "error", "result"]);
  const statusText = first(result, ["ErrMsg", "Message", "message", "Description", "statusText"]);
  if (resultCode !== "0" && resultCode !== "000") throw new Error(`HYP zikoyAPI ${resultCode || "UNKNOWN"}: ${statusText || safeResponse(body).slice(0, 300)}`);
  const refundTranId = first(result, ["TransId", "tranId", "Id", "id"]);
  console.info("hyp.refund.response", { resultCode, refundTranId, sourceTransactionId: transactionId });
  return { resultCode, refundTranId, statusText: statusText || "Refund approved", rawResponse: safeResponse(body) };
}
