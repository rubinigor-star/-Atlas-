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
function safeProviderResponse(body: string) {
  return body.replace(/(PassP=)[^&\s]+/gi, "$1[REDACTED]").slice(0, 20_000);
}
function isApprovalAuthorizationCode(code: string) {
  // 800 = YaadPay Postpone (our approval flow). 700 = legacy J5 success.
  return code === "0" || code === "000" || code === "700" || code === "800";
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
  const code = result.get("CCode") || result.get("Error") || result.get("error") || "";
  const accepted = what === "VERIFY" ? (!code || isApprovalAuthorizationCode(code)) : (!code || code === "0" || code === "000");
  if (!accepted) {
    throw new Error(`HYP APISign ${code || "UNKNOWN"}: ${result.get("ErrMsg") || result.get("Message") || "request rejected"}`);
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
    J5: "False",
    tmp: optional("HYP_TEMPLATE") || "1",
    ReturnUrl: callbackUrl(input.callbackPath, "success"),
    SuccessUrl: callbackUrl(input.callbackPath, "success"),
    ErrorUrl: callbackUrl(input.callbackPath, "error"),
    CancelUrl: callbackUrl(input.callbackPath, "cancel"),
  });

  const signed = await callApiSign("SIGN", paymentParams);
  if (signed.get("action") !== "pay") throw new Error("HYP APISign response does not contain action=pay");
  if (!signed.get("signature")) throw new Error("HYP APISign response does not contain signature");
  if (signed.get("Postpone") !== "True") throw new Error("HYP did not preserve Postpone=True");
  if (signed.get("J5") === "True") throw new Error("HYP unexpectedly enabled J5 together with Postpone");
  const paymentUrl = `${HYP_ENDPOINT}?${signed.toString()}`;
  console.info("hyp.approval.payment_page.created", { orderId, amountMinor: input.amountMinor, mode: "POSTPONE" });
  return paymentUrl;
}

export type HypApprovalRedirect = {
  success: boolean;
  outcome: string;
  code: string;
  orderId: string;
  transId: string;
  amount: string;
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
  const providerSuccess = isApprovalAuthorizationCode(code);
  return {
    success: providerSuccess && outcome !== "error" && outcome !== "cancel",
    outcome: outcome || (providerSuccess ? "success" : "error"),
    code: code || (outcome === "success" ? "0" : outcome || "UNKNOWN"),
    orderId,
    transId,
    amount: url.searchParams.get("Amount") || url.searchParams.get("amount") || "",
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
    const ok = Boolean(code) && isApprovalAuthorizationCode(code);
    console.info("hyp.approval.callback.verified", { orderId: result.orderId, code: code || null, verified: ok });
    return ok;
  } catch (error) {
    console.error("hyp.approval.callback.verification_failed", { orderId: result.orderId, message: error instanceof Error ? error.message : "Unknown verification error" });
    return false;
  }
}

export type HypCaptureResult = { resultCode: string; captureTranId: string; statusText: string; rawResponse: string };
export async function captureHypAuthorization(input: { transactionId: string; amountMinor: number; description?: string }): Promise<HypCaptureResult> {
  const transactionId = input.transactionId.trim();
  if (!/^\d+$/.test(transactionId)) throw new Error("HYP TransId не сохранён для завершения Postpone");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Некорректная сумма HYP commitTrans");
  const params = new URLSearchParams({
    action: "commitTrans",
    Masof: required("HYP_MASOF"),
    PassP: required("HYP_PASSP"),
    TransId: transactionId,
    Amount: (input.amountMinor / 100).toFixed(2),
    SendHesh: "True",
    UTF8: "True",
    UTF8out: "True",
    sendHeshSMS: "True",
    heshDesc: safeText(input.description || "Atlas approved order", 120),
  });
  console.info("hyp.approval.commit.request", { transactionId, amountMinor: input.amountMinor, params: redact(params) });
  const response = await fetch(HYP_ENDPOINT, {
    method: "POST",
    headers: { "User-Agent": "Atlas-One-HYP-Commit/1.0", "content-type": "application/x-www-form-urlencoded", Accept: "text/plain, application/x-www-form-urlencoded, application/json, */*" },
    body: params,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP commitTrans HTTP ${response.status}`);
  if (!body) throw new Error("HYP commitTrans returned an empty response");
  const result = parseHypBody(body);
  const code = result.get("CCode") || result.get("Error") || result.get("error") || "";
  if (code !== "0" && code !== "000") {
    throw new Error(`HYP commitTrans ${code || "UNKNOWN"}: ${result.get("ErrMsg") || result.get("Message") || "request rejected"}`);
  }
  const captureTranId = result.get("Id") || result.get("TransId") || transactionId;
  console.info("hyp.approval.commit.response", { transactionId, captureTranId, code });
  return { resultCode: code || "0", captureTranId, statusText: result.get("ErrMsg") || result.get("Message") || "Captured", rawResponse: safeProviderResponse(body) };
}

export type HypCancelAuthorizationResult = { resultCode: string; cancelTranId: string; statusText: string; rawResponse: string };
export async function cancelHypAuthorization(input: { transactionId: string }): Promise<HypCancelAuthorizationResult> {
  const transactionId = input.transactionId.trim();
  if (!/^\d+$/.test(transactionId)) throw new Error("HYP TransId не сохранён для отклонения Postpone");
  // Postpone is charged only by explicit commitTrans. Rejection never calls commitTrans.
  // Atlas closes the authorization locally so a rejected request cannot later be captured.
  console.info("hyp.approval.not_committed", { transactionId });
  return { resultCode: "NOT_COMMITTED", cancelTranId: transactionId, statusText: "Postponed transaction was not committed", rawResponse: JSON.stringify({ transactionId, action: "not-committed" }) };
}
