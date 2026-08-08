import { createHash, timingSafeEqual } from "crypto";

const RELAY_TIMEOUT_MS = 30_000;

type RelayEnv = "HYP_RELAY_URL" | "HYP_API_USER" | "HYP_API_PASSWORD" | "HYP_MPI_MID";

function required(name: RelayEnv) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured for HYP two-phase payments`);
  return value;
}
function optional(name: string) { return process.env[name]?.trim() || ""; }
function terminalNumber() {
  const value = optional("HYP_TERMINAL_NUMBER") || optional("HYP_MASOF");
  if (!value) throw new Error("HYP_TERMINAL_NUMBER is not configured for HYP two-phase payments");
  return value;
}
function deploymentOrigin() {
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
}
function callbackUrl(path: string, outcome: "success" | "error" | "cancel") {
  const url = new URL(path, deploymentOrigin());
  url.searchParams.set("providerOutcome", outcome);
  return url.toString();
}
function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function xmlValue(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() || "";
}
function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
function safeResponse(value: string) {
  return value.replace(/(<password>)[\s\S]*?(<\/password>)/gi, "$1[REDACTED]$2").slice(0, 20_000);
}

async function relay(xml: string) {
  const endpoint = required("HYP_RELAY_URL");
  if (!/^https:\/\//i.test(endpoint)) throw new Error("HYP_RELAY_URL must use HTTPS");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "User-Agent": "Atlas-One-HYP-CreditGuard/1.0" },
    body: new URLSearchParams({ user: required("HYP_API_USER"), password: required("HYP_API_PASSWORD"), int_in: xml }),
    cache: "no-store",
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  });
  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP Relay HTTP ${response.status}`);
  if (!body) throw new Error("HYP Relay returned an empty response");
  return body;
}

export async function createHypApprovalPaymentPage(input: { amountMinor: number; orderId: string; callbackPath: string; language?: "HEB" | "ENG" }) {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Некорректная сумма HYP authorization");
  const orderId = input.orderId.trim().slice(0, 64);
  if (!orderId) throw new Error("HYP order ID is required");
  const successUrl = callbackUrl(input.callbackPath, "success");
  const errorUrl = callbackUrl(input.callbackPath, "error");
  const cancelUrl = callbackUrl(input.callbackPath, "cancel");
  const xml = `<ashrait><request><version>2000</version><language>${input.language || "ENG"}</language><command>doDeal</command><doDeal><terminalNumber>${esc(terminalNumber())}</terminalNumber><cardNo>CGMPI</cardNo><total>${input.amountMinor}</total><transactionType>Debit</transactionType><creditType>RegularCredit</creditType><currency>ILS</currency><transactionCode>Internet</transactionCode><validation>TxnSetup</validation><mid>${esc(required("HYP_MPI_MID"))}</mid><uniqueid>${esc(orderId)}</uniqueid><mpiValidation>Verify</mpiValidation><successUrl>${esc(successUrl)}</successUrl><errorUrl>${esc(errorUrl)}</errorUrl><cancelUrl>${esc(cancelUrl)}</cancelUrl></doDeal></request></ashrait>`;
  console.info("hyp.creditguard.authorization_page.request", { orderId, amountMinor: input.amountMinor });
  const body = await relay(xml);
  const resultCode = xmlValue(body, "result");
  const message = xmlValue(body, "userMessage") || xmlValue(body, "message");
  if (resultCode !== "000") throw new Error(`HYP TxnSetup ${resultCode || "UNKNOWN"}: ${message || "request rejected"}`);
  const paymentUrl = decodeXml(xmlValue(body, "mpiHostedPageUrl"));
  if (!/^https:\/\//i.test(paymentUrl)) throw new Error("HYP TxnSetup did not return a valid payment page URL");
  console.info("hyp.creditguard.authorization_page.created", { orderId, resultCode });
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
  const code = url.searchParams.get("errorCode") || "";
  const orderId = url.searchParams.get("uniqueID") || url.searchParams.get("uniqueId") || "";
  const txId = url.searchParams.get("txId") || "";
  const cgUid = url.searchParams.get("cgUid") || "";
  const cardToken = url.searchParams.get("cardToken") || "";
  const cardExp = url.searchParams.get("cardExp") || "";
  return {
    success: outcome === "success" && (!code || code === "000"),
    outcome,
    code: code || (outcome === "success" ? "000" : outcome || "UNKNOWN"),
    orderId,
    transId: cgUid || txId,
    txId,
    uniqueId: orderId,
    cgUid,
    authorizationCode: url.searchParams.get("authNumber") || "",
    cardToken,
    cardExp,
    cardMask: url.searchParams.get("cardMask") || "",
    raw: Object.fromEntries(url.searchParams.entries()),
  };
}

export function verifyHypApprovalResponseMac(url: URL) {
  const responseMac = url.searchParams.get("responseMac") || "";
  const txId = url.searchParams.get("txId") || "";
  const uniqueId = url.searchParams.get("uniqueID") || url.searchParams.get("uniqueId") || "";
  if (!responseMac || !txId || !uniqueId) return false;
  const base = [
    required("HYP_API_PASSWORD"),
    txId,
    url.searchParams.get("errorCode") || "000",
    url.searchParams.get("cardToken") || "",
    url.searchParams.get("cardExp") || "",
    url.searchParams.get("personalId") || "",
    uniqueId,
  ].join("");
  const calculated = createHash("sha256").update(base).digest("hex");
  const received = responseMac.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(received)) return false;
  return timingSafeEqual(Buffer.from(calculated, "hex"), Buffer.from(received, "hex"));
}

export type HypCaptureResult = { resultCode: string; captureTranId: string; statusText: string; rawResponse: string };
export async function captureHypAuthorization(input: { cardToken: string; cardExp: string; cgUid: string; amountMinor: number }): Promise<HypCaptureResult> {
  const cardToken = input.cardToken.trim();
  const cardExp = input.cardExp.replace(/\D/g, "");
  const cgUid = input.cgUid.trim();
  if (!/^\d{8,32}$/.test(cardToken)) throw new Error("HYP cardToken не сохранён для предварительной авторизации");
  if (!/^\d{4}$/.test(cardExp)) throw new Error("HYP cardExp не сохранён для предварительной авторизации");
  if (!cgUid) throw new Error("HYP cgUid не сохранён для предварительной авторизации");
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) throw new Error("Некорректная сумма списания HYP");
  const xml = `<ashrait><request><version>2000</version><language>ENG</language><command>doDeal</command><doDeal><terminalNumber>${esc(terminalNumber())}</terminalNumber><cardId>${esc(cardToken)}</cardId><cardExpiration>${esc(cardExp)}</cardExpiration><total>${input.amountMinor}</total><transactionType>Debit</transactionType><creditType>RegularCredit</creditType><currency>ILS</currency><transactionCode>Phone</transactionCode><validation>AutoComm</validation><cgUid>${esc(cgUid)}</cgUid></doDeal></request></ashrait>`;
  console.info("hyp.creditguard.capture.request", { cgUid, amountMinor: input.amountMinor });
  const body = await relay(xml);
  const resultCode = xmlValue(body, "result");
  const statusText = xmlValue(body, "userMessage") || xmlValue(body, "message");
  if (resultCode !== "000") throw new Error(`HYP capture ${resultCode || "UNKNOWN"}: ${statusText || "request rejected"}`);
  const captureTranId = xmlValue(body, "tranId");
  console.info("hyp.creditguard.capture.response", { cgUid, resultCode, captureTranId });
  return { resultCode, captureTranId, statusText: statusText || "Capture approved", rawResponse: safeResponse(body) };
}

export type HypCancelAuthorizationResult = { resultCode: string; cancelTranId: string; statusText: string; rawResponse: string };
export async function cancelHypAuthorization(input: { cgUid: string }): Promise<HypCancelAuthorizationResult> {
  const cgUid = input.cgUid.trim();
  if (!cgUid) throw new Error("HYP cgUid не сохранён для отмены предварительной авторизации");
  const xml = `<ashrait><request><version>2000</version><language>ENG</language><command>cancelDeal</command><cancelDeal><terminalNumber>${esc(terminalNumber())}</terminalNumber><cgUid>${esc(cgUid)}</cgUid></cancelDeal></request></ashrait>`;
  console.info("hyp.creditguard.authorization_cancel.request", { cgUid });
  const body = await relay(xml);
  const resultCode = xmlValue(body, "result");
  const statusText = xmlValue(body, "userMessage") || xmlValue(body, "message");
  if (resultCode !== "000" && resultCode !== "314") throw new Error(`HYP cancelDeal ${resultCode || "UNKNOWN"}: ${statusText || "request rejected"}`);
  const cancelTranId = xmlValue(body, "tranId");
  console.info("hyp.creditguard.authorization_cancel.response", { cgUid, resultCode, cancelTranId });
  return { resultCode, cancelTranId, statusText: statusText || "Authorization cancelled", rawResponse: safeResponse(body) };
}
