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
function deploymentOrigin() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}
function callbackUrl(path: string, outcome: "success" | "error" | "cancel") {
  const url = new URL(path, deploymentOrigin());
  url.searchParams.set("providerOutcome", outcome);
  return url.toString();
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

async function callApiSign(what: "SIGN" | "VERIFY", paymentParams: URLSearchParams) {
  const requestParams = new URLSearchParams({
    action: "APISign",
    What: what,
    KEY: required("HYP_API_KEY"),
    PassP: required("HYP_PASSP"),
    Masof: required("HYP_MASOF"),
  });
  for (const [key, value] of paymentParams.entries()) {
    if (!["action", "What", "KEY", "PassP", "Masof"].includes(key)) requestParams.append(key, value);
  }
  console.info("hyp.approval.apisign.request", { what, params: redact(requestParams) });
  const response = await fetch(`${HYP_ENDPOINT}?${requestParams.toString()}`, {
    method: "GET",
    headers: { "User-Agent": "Atlas-One-HYP-Approval/1.0", Accept: "text/plain, application/x-www-form-urlencoded, application/json, */*" },
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
  return result;
}

export function assertHypTwoPhaseConfigured() {
  required("HYP_MASOF");
  required("HYP_API_KEY");
  required("HYP_PASSP");
}

export async function createHypApprovalPaymentPage(input: { amountMinor: number; orderId: string; callbackPath: string; language?: "HEB" | "ENG" }) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Некорректная сумма HYP authorization");
  const orderId = safeText(input.orderId, 64);
  if (!orderId) throw new Error("HYP order ID is required");

  const paymentParams = new URLSearchParams({
    action: "pay",
    Masof: required("HYP_MASOF"),
    Amount: (input.amountMinor / 100).toFixed(2),
    Coin: "1",
    Info: safeText(`Atlas approval ${orderId}`, 120),
    Order: orderId,
    ClientName: "Atlas",
    ClientLName: "Customer",
    PageLang: input.language || "HEB",
    UTF8: "True",
    UTF8out: "True",
    MoreData: "True",
    Sign: "True",
    Tash: "1",
    FixTash: "True",
    sendemail: "False",
    SendHesh: "False",
    Postpone: "True",
    J5: "True",
    tmp: optional("HYP_TEMPLATE") || "1",
    ReturnUrl: callbackUrl(input.callbackPath, "success"),
    SuccessUrl: callbackUrl(input.callbackPath, "success"),
    ErrorUrl: callbackUrl(input.callbackPath, "error"),
    CancelUrl: callbackUrl(input.callbackPath, "cancel"),
  });

  const signed = await callApiSign("SIGN", paymentParams);
  if (signed.get("action") !== "pay") throw new Error("HYP APISign response does not contain action=pay");
  if (!signed.get("signature")) throw new Error("HYP APISign response does not contain signature");
  if (signed.get("J5") !== "True" || signed.get("Postpone") !== "True") {
    throw new Error("HYP did not preserve J5/Postpone authorization parameters");
  }
  const paymentUrl = `${HYP_ENDPOINT}?${signed.toString()}`;
  console.info("hyp.approval.payment_page.created", { orderId, amountMinor: input.amountMinor, j5: true, postpone: true });
  return paymentUrl;
}

export type HypApprovalRedirect = {
  success: boolean;
  outcome: string;
  code: string;
  orderId: string;
  transId: string;
  txId: string;
  uniqueId: string;
  cgUid: string;
  authorizationCode: string;
  cardToken: string;
  cardExp: string;
  cardMask: string;
  raw: Record<string, string>;
};

export function hypApprovalResultFromUrl(url: URL): HypApprovalRedirect {
  const outcome = url.searchParams.get("providerOutcome") || "";
  const code = url.searchParams.get("CCode") || url.searchParams.get("code") || url.searchParams.get("Error") || "";
  const transId = url.searchParams.get("TransId") || url.searchParams.get("Id") || url.searchParams.get("tranId") || "";
  const orderId = url.searchParams.get("Order") || url.searchParams.get("order") || "";
  return {
    success: (code === "0" || code === "000") && outcome !== "error" && outcome !== "cancel",
    outcome: outcome || ((code === "0" || code === "000") ? "success" : "error"),
    code: code || ((outcome === "success") ? "0" : outcome || "UNKNOWN"),
    orderId,
    transId,
    txId: transId,
    uniqueId: orderId,
    cgUid: url.searchParams.get("cgUid") || "",
    authorizationCode: url.searchParams.get("ACode") || url.searchParams.get("authNumber") || "",
    cardToken: url.searchParams.get("Token") || url.searchParams.get("token") || url.searchParams.get("cardToken") || url.searchParams.get("CardToken") || "",
    cardExp: url.searchParams.get("Tokef") || url.searchParams.get("tokef") || url.searchParams.get("cardExp") || url.searchParams.get("CardExp") || "",
    cardMask: url.searchParams.get("L4digit") || url.searchParams.get("cardMask") || "",
    raw: Object.fromEntries(url.searchParams.entries()),
  };
}

export async function verifyHypApprovalResponseMac(url: URL) {
  const result = hypApprovalResultFromUrl(url);
  if (!result.success || !result.orderId) return false;
  try {
    const verified = await callApiSign("VERIFY", new URLSearchParams(url.searchParams));
    const code = verified.get("CCode") || verified.get("code") || verified.get("Error") || "";
    const ok = code === "0" || code === "000";
    console.info("hyp.approval.callback.verified", { orderId: result.orderId, code, verified: ok });
    return ok;
  } catch (error) {
    console.error("hyp.approval.callback.verification_failed", { orderId: result.orderId, message: error instanceof Error ? error.message : "Unknown verification error" });
    return false;
  }
}

export type HypCaptureResult = { resultCode: string; captureTranId: string; statusText: string; rawResponse: string };
export async function captureHypAuthorization(): Promise<HypCaptureResult> {
  throw new Error("HYP J5 capture is not wired to the YaadPay APISign completion endpoint yet");
}

export type HypCancelAuthorizationResult = { resultCode: string; cancelTranId: string; statusText: string; rawResponse: string };
export async function cancelHypAuthorization(): Promise<HypCancelAuthorizationResult> {
  throw new Error("HYP J5 cancellation is not wired to the YaadPay APISign completion endpoint yet");
}
