const REQUEST_TIMEOUT_MS = 20_000;
const DEFAULT_HYP_API_ENDPOINT = "https://pay.hyp.co.il/xpo/Relay";

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
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

function apiCredentials() {
  const endpoint = process.env.HYP_RELAY_URL?.trim() || DEFAULT_HYP_API_ENDPOINT;
  if (!/^https:\/\//i.test(endpoint)) throw new Error("HYP API URL must use HTTPS");

  return {
    endpoint,
    user: required("HYP_API_KEY"),
    password: required("HYP_PASSP"),
  };
}

export async function refundHypByCgUid(cgUidInput: string) {
  const cgUid = cgUidInput.replace(/\D/g, "").slice(0, 32);
  if (!cgUid) throw new Error("Не найден cgUid исходной транзакции HYP");

  const { endpoint, user, password } = apiCredentials();
  const xml = `<ashrait><request><version>2000</version><language>Eng</language><command>refundDeal</command><refundDeal><terminalNumber>${xmlEscape(required("HYP_MASOF"))}</terminalNumber><cgUid>${xmlEscape(cgUid)}</cgUid></refundDeal></request></ashrait>`;
  const form = new URLSearchParams({ user, password, int_in: xml });

  console.info("hyp.refund.request", {
    endpoint: new URL(endpoint).origin + new URL(endpoint).pathname,
    cgUid,
    command: "refundDeal",
    fullRefund: true,
    credentialsSource: "HYP_API_KEY/HYP_PASSP",
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
  console.info("hyp.refund.response", {
    httpStatus: response.status,
    contentType: response.headers.get("content-type") || "",
    bodyPrefix: body.slice(0, 240),
  });

  if (!response.ok) throw new Error(`HYP API HTTP ${response.status}`);
  if (!body) throw new Error("HYP API returned an empty response");

  const result = xmlValue(body, "result") || xmlValue(body, "status");
  const status = xmlValue(body, "status") || result;
  const message = xmlValue(body, "userMessage") || xmlValue(body, "message") || xmlValue(body, "statusText");
  const refundTransactionId = xmlValue(body, "tranId");

  if (result !== "000" || (status && status !== "000")) {
    throw new Error(`HYP refund ${result || status || "UNKNOWN"}: ${message || "request rejected"}`);
  }
  if (!refundTransactionId) throw new Error("HYP подтвердил возврат без идентификатора транзакции");

  return {
    transactionId: refundTransactionId,
    result,
    message,
    cgUid,
  };
}
