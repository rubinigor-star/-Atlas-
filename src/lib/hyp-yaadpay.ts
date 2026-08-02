import { createHmac } from "crypto";

const LEGACY_HYP_ENDPOINT = "https://pay.hyp.co.il/p/";
const REQUEST_TIMEOUT_MS = 15_000;

type IntegrationMode = "legacy" | "relay";

type RequiredEnv =
  | "HYP_MASOF"
  | "HYP_API_KEY"
  | "HYP_RELAY_URL"
  | "HYP_API_USER"
  | "HYP_API_PASSWORD"
  | "HYP_TERMINAL_NUMBER"
  | "HYP_MPI_MID";

function required(name: RequiredEnv) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function optional(name: string) {
  return process.env[name]?.trim() || "";
}

function integrationMode(): IntegrationMode {
  return optional("HYP_INTEGRATION_MODE").toLowerCase() === "relay" ? "relay" : "legacy";
}

function safeText(value: string, max = 120) {
  return value.replace(/[<>\r\n]/g, " ").trim().slice(0, max);
}

function xmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match?.[1]?.trim() || "";
}

async function relayRequest(xml: string) {
  const body = new URLSearchParams({
    user: required("HYP_API_USER"),
    password: required("HYP_API_PASSWORD"),
    int_in: xml,
  });

  const response = await fetch(required("HYP_RELAY_URL"), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Atlas-One/2.0",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const responseText = (await response.text()).trim();
  if (!response.ok) {
    throw new Error(`HYP Relay HTTP ${response.status}`);
  }

  const result = tag(responseText, "result") || tag(responseText, "responseCode");
  if (result && result !== "000" && result !== "0") {
    const message = tag(responseText, "message") || tag(responseText, "resultMessage") || "Unknown HYP error";
    throw new Error(`HYP Relay ${result}: ${message}`);
  }

  return responseText;
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

async function createRelayPaymentLink(input: HypPaymentLinkInput) {
  const totalMinor = Math.round(input.amountIls * 100);
  const uniqueId = safeText(input.orderId, 64);
  const language = input.language || "HEB";
  const successUrl = input.returnUrl;
  const errorUrl = input.returnUrl;
  const cancelUrl = input.returnUrl;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ashrait>
  <request>
    <version>2000</version>
    <language>${xmlText(language)}</language>
    <command>doDeal</command>
    <doDeal>
      <terminalNumber>${xmlText(required("HYP_TERMINAL_NUMBER"))}</terminalNumber>
      <cardNo>CGMPI</cardNo>
      <total>${totalMinor}</total>
      <transactionType>Debit</transactionType>
      <creditType>RegularCredit</creditType>
      <currency>ILS</currency>
      <transactionCode>Internet</transactionCode>
      <validation>TxnSetup</validation>
      <mid>${xmlText(required("HYP_MPI_MID"))}</mid>
      <uniqueid>${xmlText(uniqueId)}</uniqueid>
      <mpiValidation>AutoComm</mpiValidation>
      <successUrl>${xmlText(successUrl)}</successUrl>
      <errorUrl>${xmlText(errorUrl)}</errorUrl>
      <cancelUrl>${xmlText(cancelUrl)}</cancelUrl>
      <customerData>
        <customerName>${xmlText(safeText(input.customerName || "Atlas Customer", 100))}</customerName>
        <email>${xmlText(safeText(input.customerEmail || "", 120))}</email>
        <phoneNumber>${xmlText(safeText(input.customerPhone || "", 30))}</phoneNumber>
      </customerData>
      <description>${xmlText(safeText(input.description, 120))}</description>
    </doDeal>
  </request>
</ashrait>`;

  const responseXml = await relayRequest(xml);
  const hostedUrl = tag(responseXml, "mpiHostedPageUrl") || tag(responseXml, "url");
  if (!hostedUrl || !/^https:\/\//i.test(hostedUrl)) {
    throw new Error("HYP Relay did not return mpiHostedPageUrl");
  }
  return hostedUrl;
}

async function createLegacyPaymentLink(input: HypPaymentLinkInput) {
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

  return `${LEGACY_HYP_ENDPOINT}?${signedQuery(params)}`;
}

export async function createHypPaymentLink(input: HypPaymentLinkInput) {
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Некорректная сумма оплаты");
  if (!/^https:\/\//i.test(input.returnUrl)) throw new Error("Адрес возврата HYP должен использовать HTTPS");
  return integrationMode() === "relay" ? createRelayPaymentLink(input) : createLegacyPaymentLink(input);
}

function hypHeaders() {
  const origin = (optional("NEXT_PUBLIC_APP_URL") || "https://www.atlas-one.co").replace(/\/$/, "");
  return { Referer: `${origin}/`, Origin: origin, "User-Agent": "Atlas-One/1.0" };
}

export async function verifyHypCallback(url: URL) {
  if (integrationMode() === "relay") {
    const code = url.searchParams.get("responseCode") || url.searchParams.get("result") || url.searchParams.get("CCode") || "";
    const uniqueId = url.searchParams.get("uniqueID") || url.searchParams.get("uniqueId") || "";
    const cgUid = url.searchParams.get("cgUid") || "";
    return (code === "000" || code === "0") && Boolean(uniqueId) && Boolean(cgUid);
  }

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
    const response = await fetch(`${LEGACY_HYP_ENDPOINT}?${params.toString()}`, {
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
  const code =
    url.searchParams.get("responseCode") ||
    url.searchParams.get("result") ||
    url.searchParams.get("CCode") ||
    url.searchParams.get("code") ||
    url.searchParams.get("errorCode") ||
    "";
  const success = code === "0" || code === "000" || url.searchParams.get("status")?.toLowerCase() === "success";
  return {
    success,
    code,
    orderId:
      url.searchParams.get("uniqueID") ||
      url.searchParams.get("uniqueId") ||
      url.searchParams.get("Order") ||
      url.searchParams.get("order") ||
      "",
    transactionId:
      url.searchParams.get("cgUid") ||
      url.searchParams.get("tranId") ||
      url.searchParams.get("Id") ||
      url.searchParams.get("TransId") ||
      url.searchParams.get("txId") ||
      "",
    cgUid: url.searchParams.get("cgUid") || "",
    tranId: url.searchParams.get("tranId") || "",
    txId: url.searchParams.get("txId") || "",
    amount: url.searchParams.get("Amount") || url.searchParams.get("amount") || url.searchParams.get("total") || "",
    cardMask: url.searchParams.get("cardMask") || url.searchParams.get("L4digit") || "",
    raw: params,
  };
}

async function refundRelayDeal(input: { transactionId: string; amountMinor?: number }) {
  const total = input.amountMinor ? `<total>${input.amountMinor}</total>` : "";
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ashrait>
  <request>
    <version>2000</version>
    <language>ENG</language>
    <command>refundDeal</command>
    <refundDeal>
      <terminalNumber>${xmlText(required("HYP_TERMINAL_NUMBER"))}</terminalNumber>
      <cgUid>${xmlText(input.transactionId.trim())}</cgUid>
      ${total}
    </refundDeal>
  </request>
</ashrait>`;

  const responseXml = await relayRequest(xml);
  const code = tag(responseXml, "result") || tag(responseXml, "responseCode") || "000";
  const transactionId = tag(responseXml, "tranId") || tag(responseXml, "cgUid") || input.transactionId;
  return { code, message: "Refund accepted", transactionId };
}

async function refundLegacyDeal(input: { transactionId: string }) {
  const passP = optional("HYP_PASSP");
  if (!passP) throw new Error("HYP_PASSP is not configured");

  const params = new URLSearchParams({
    action: "CancelTrans",
    Masof: required("HYP_MASOF"),
    PassP: passP,
    TransId: input.transactionId.trim(),
  });
  const response = await fetch(`${LEGACY_HYP_ENDPOINT}?${params.toString()}`, {
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

export async function refundHypDeal(input: { transactionId: string; amountMinor?: number }) {
  if (!input.transactionId.trim()) throw new Error("Не найден идентификатор транзакции HYP");
  return integrationMode() === "relay" ? refundRelayDeal(input) : refundLegacyDeal(input);
}
