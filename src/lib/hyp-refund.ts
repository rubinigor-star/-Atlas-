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

function sanitizeResponseBody(body: string) {
  return body.replace(/[\r\n\t]+/g, " ").trim().slice(0, 700);
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
  const amount = Number.isInteger(amountIls) ? String(amountIls) : amountIls.toFixed(2);
  const params = new URLSearchParams({
    action: "zikoyAPI",
    Masof: required("HYP_MASOF"),
    PassP: required("HYP_PASSP"),
    TransId: transactionId,
    Amount: amount,
  });

  const safeLogParams = new URLSearchParams(params);
  safeLogParams.set("PassP", "[REDACTED]");
  console.info("hyp.refund.request", {
    endpoint: HYP_ENDPOINT,
    params: safeLogParams.toString(),
    transactionId,
    amount,
    amountMinor: input.amountMinor,
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
  const parsed = parseHypResponse(body);
  const responseFields = Object.fromEntries(parsed.entries());

  console.info("hyp.refund.response", {
    httpStatus: response.status,
    contentType: response.headers.get("content-type") || "",
    body: sanitizeResponseBody(body),
    fields: responseFields,
  });

  if (!response.ok) {
    throw new Error(`HYP zikoyAPI HTTP ${response.status}: ${sanitizeResponseBody(body) || "empty response"}`);
  }
  if (!body) throw new Error("HYP zikoyAPI returned an empty response");

  const code = parsed.get("CCode") || parsed.get("code") || parsed.get("Error") || "";
  const message =
    parsed.get("errMsg") ||
    parsed.get("ErrMsg") ||
    parsed.get("ErrorText") ||
    parsed.get("Message") ||
    parsed.get("message") ||
    "";
  const refundTransactionId = parsed.get("Id") || parsed.get("TransId") || "";

  if (code !== "0" && code !== "000") {
    const diagnostics = sanitizeResponseBody(body);
    throw new Error(
      `HYP refund ${code || "UNKNOWN"}: ${message || diagnostics || "request rejected"}`,
    );
  }
  if (!refundTransactionId) {
    throw new Error(`HYP подтвердил возврат без нового Id операции: ${sanitizeResponseBody(body)}`);
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
