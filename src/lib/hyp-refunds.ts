import { randomUUID } from "crypto";

const REQUEST_TIMEOUT_MS = 20_000;
const HYP_ENDPOINT = "https://pay.hyp.co.il/p/";

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

function required(name: "HYP_MASOF" | "HYP_PASSP") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function safeResponse(value: string) {
  return value
    .replace(/(PassP=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/("?PassP"?\s*[:=]\s*")[^"]+/gi, "$1[REDACTED]")
    .slice(0, 20_000);
}

function parseResponse(body: string) {
  const trimmed = body.trim();

  try {
    const json = JSON.parse(trimmed) as Record<string, unknown>;
    return new URLSearchParams(
      Object.entries(json).map(([key, value]) => [key, value == null ? "" : String(value)]),
    );
  } catch {
    return new URLSearchParams(trimmed.replace(/^\?/, ""));
  }
}

function first(params: URLSearchParams, names: string[]) {
  for (const name of names) {
    const value = params.get(name);
    if (value) return value;
  }
  return "";
}

export function createRefundIdempotencyKey(orderId: string, amountMinor: number, reason: string) {
  return `refund_${orderId}_${amountMinor}_${reason.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 40)}_${randomUUID()}`;
}

export async function refundHypDeal(input: RefundInput): Promise<HypRefundResult> {
  const sourceTransactionId = input.tranId?.trim() || input.cgUid?.trim() || "";
  if (!sourceTransactionId) {
    throw new Error("Не найден TransId исходной транзакции HYP");
  }
  if (input.amountMinor !== undefined && (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)) {
    throw new Error("Некорректная сумма возврата");
  }

  const params = new URLSearchParams({
    action: "zikoyAPI",
    Masof: required("HYP_MASOF"),
    PassP: required("HYP_PASSP"),
    TransId: sourceTransactionId,
  });

  if (input.amountMinor !== undefined) {
    params.set("Amount", (input.amountMinor / 100).toFixed(2));
  }

  console.info("hyp.refund.request", {
    endpoint: HYP_ENDPOINT,
    action: "zikoyAPI",
    masofConfigured: true,
    sourceTransactionId,
    amount: input.amountMinor === undefined ? "full" : (input.amountMinor / 100).toFixed(2),
  });

  const response = await fetch(`${HYP_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: {
      "User-Agent": "Atlas-One-HYP-Refunds/1.0",
      Accept: "text/plain, application/x-www-form-urlencoded, application/json, */*",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = (await response.text()).trim();
  if (!response.ok) {
    throw new Error(`HYP zikoyAPI HTTP ${response.status}: ${safeResponse(body).slice(0, 300)}`);
  }
  if (!body) throw new Error("HYP вернул пустой ответ на возврат");

  const result = parseResponse(body);
  const resultCode = first(result, ["CCode", "Code", "code", "Error", "error", "result"]);
  const statusText = first(result, ["ErrMsg", "Message", "message", "Description", "statusText"]);
  const success = resultCode === "0" || resultCode === "000";

  if (!success) {
    throw new Error(`HYP zikoyAPI ${resultCode || "UNKNOWN"}: ${statusText || safeResponse(body).slice(0, 300)}`);
  }

  const refundTranId = first(result, ["TransId", "tranId", "Id", "id"]);
  const cgUid = first(result, ["cgUid", "CgUid"]);
  const amount = Number(first(result, ["Amount", "amount"]));

  console.info("hyp.refund.response", {
    resultCode,
    refundTranId,
    sourceTransactionId,
    amount: Number.isFinite(amount) ? amount : null,
  });

  return {
    resultCode,
    refundTranId,
    cgUid: cgUid || input.cgUid?.trim() || "",
    status: resultCode,
    statusText: statusText || "Permitted transaction",
    orgUid: "",
    orgAmountMinor: Number.isFinite(amount) ? Math.round(amount * 100) : null,
    rawResponse: safeResponse(body),
  };
}
