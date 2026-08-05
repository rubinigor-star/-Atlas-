import { randomUUID } from "crypto";

const REQUEST_TIMEOUT_MS = 20_000;

type RefundInput = {
  cgUid?: string | null;
  tranId?: string | null;
  amountMinor?: number;
};

export type HypRefundResult = {
  resultCode: string;
  refundTranId: string;
  cgUid: string;
  status: string;
  statusText: string;
  orgUid: string;
  orgAmountMinor: number | null;
  rawResponse: string;
};

function required(name: "HYP_RELAY_URL" | "HYP_API_USER" | "HYP_API_PASSWORD" | "HYP_TERMINAL_NUMBER") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function xmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match?.[1]?.trim() || "";
}

function safeResponse(xml: string) {
  return xml
    .replace(/<cardNo>[\s\S]*?<\/cardNo>/gi, "<cardNo>[REDACTED]</cardNo>")
    .replace(/<password>[\s\S]*?<\/password>/gi, "<password>[REDACTED]</password>")
    .slice(0, 20_000);
}

export function createRefundIdempotencyKey(orderId: string, amountMinor: number, reason: string) {
  return `refund_${orderId}_${amountMinor}_${reason.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40)}_${randomUUID()}`;
}

export async function refundHypDeal(input: RefundInput): Promise<HypRefundResult> {
  const cgUid = input.cgUid?.trim() || "";
  const tranId = input.tranId?.trim() || "";
  if (!cgUid && !tranId) throw new Error("Не найден cgUid или tranId исходной транзакции HYP");
  if (input.amountMinor !== undefined && (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)) {
    throw new Error("Некорректная сумма возврата");
  }

  const lookup = cgUid
    ? `<cgUid>${xmlText(cgUid)}</cgUid>`
    : `<tranId>${xmlText(tranId)}</tranId>`;
  const total = input.amountMinor === undefined ? "" : `<total>${input.amountMinor}</total>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ashrait>
  <request>
    <version>2000</version>
    <language>Eng</language>
    <command>refundDeal</command>
    <refundDeal>
      <terminalNumber>${xmlText(required("HYP_TERMINAL_NUMBER"))}</terminalNumber>
      ${lookup}
      ${total}
    </refundDeal>
  </request>
</ashrait>`;

  const body = new URLSearchParams({
    user: required("HYP_API_USER"),
    password: required("HYP_API_PASSWORD"),
    int_in: xml,
  });
  const response = await fetch(required("HYP_RELAY_URL"), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Atlas-One-HYP-Refunds/1.0",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const responseXml = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP Relay HTTP ${response.status}`);
  if (!responseXml) throw new Error("HYP вернул пустой ответ на возврат");

  const resultCode = tag(responseXml, "result") || tag(responseXml, "responseCode");
  const statusText = tag(responseXml, "statusText") || tag(responseXml, "message") || tag(responseXml, "resultMessage");
  if (resultCode !== "000" && resultCode !== "0") {
    throw new Error(`HYP refundDeal ${resultCode || "UNKNOWN"}: ${statusText || "возврат отклонён"}`);
  }

  const orgAmount = Number(tag(responseXml, "orgAmount"));
  return {
    resultCode,
    refundTranId: tag(responseXml, "tranId"),
    cgUid: tag(responseXml, "cgUid") || cgUid,
    status: tag(responseXml, "status"),
    statusText,
    orgUid: tag(responseXml, "orgUid"),
    orgAmountMinor: Number.isFinite(orgAmount) ? orgAmount : null,
    rawResponse: safeResponse(responseXml),
  };
}
