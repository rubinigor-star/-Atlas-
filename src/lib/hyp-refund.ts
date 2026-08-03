const REQUEST_TIMEOUT_MS = 20_000;
const HYP_ENDPOINT = "https://pay.hyp.co.il/p/";

function required(name: "HYP_MASOF" | "HYP_PASSP") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function parseHypResponse(body: string) {
  return new URLSearchParams(body.trim().replace(/^\?/, ""));
}

function safeTransactionId(value: string) {
  const result = value.replace(/[^0-9A-Za-z_-]/g, "").slice(0, 80);
  if (!result) throw new Error("Не найден TransId исходной транзакции HYP");
  return result;
}

export async function refundHypTransaction(input: {
  transactionId: string;
  amountMinor: number;
}) {
  const transactionId = safeTransactionId(input.transactionId);
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new Error("Некорректная сумма возврата");
  }

  const amountIls = input.amountMinor / 100;
  const params = new URLSearchParams({
    action: "zikoyAPI",
    Masof: required("HYP_MASOF"),
    PassP: required("HYP_PASSP"),
    TransId: transactionId,
    Amount: Number.isInteger(amountIls) ? String(amountIls) : amountIls.toFixed(2),
  });

  const safeLogParams = new URLSearchParams(params);
  safeLogParams.set("PassP", "[REDACTED]");
  console.info("hyp.refund.request", {
    endpoint: HYP_ENDPOINT,
    params: safeLogParams.toString(),
  });

  const response = await fetch(`${HYP_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "text/plain, application/x-www-form-urlencoded, */*",
      "User-Agent": "Atlas-One-HYP/1.0",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const body = (await response.text()).trim();
  console.info("hyp.refund.response", {
    httpStatus: response.status,
    contentType: response.headers.get("content-type") || "",
    bodyPrefix: body.slice(0, 240),
  });

  if (!response.ok) throw new Error(`HYP zikoyAPI HTTP ${response.status}`);
  if (!body) throw new Error("HYP zikoyAPI returned an empty response");

  const result = parseHypResponse(body);
  const code = result.get("CCode") || result.get("code") || "";
  const message = result.get("errMsg") || result.get("ErrMsg") || result.get("Message") || "";
  const refundTransactionId = result.get("Id") || result.get("TransId") || "";

  if (code !== "0" && code !== "000") {
    throw new Error(`HYP refund ${code || "UNKNOWN"}: ${message || "request rejected"}`);
  }
  if (!refundTransactionId) {
    throw new Error("HYP подтвердил возврат без нового Id операции");
  }

  console.info("hyp.refund.succeeded", {
    originalTransactionId: transactionId,
    refundTransactionId,
    amountMinor: input.amountMinor,
  });

  return {
    transactionId: refundTransactionId,
    originalTransactionId: transactionId,
    code,
    message,
  };
}
