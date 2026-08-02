const REQUEST_TIMEOUT_MS = 20_000;

type RequiredEnv = "HYP_MASOF" | "HYP_API_KEY" | "HYP_PASSP" | "HYP_RELAY_URL" | "HYP_MID";

function required(name: RequiredEnv) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
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

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match?.[1]?.trim() || "";
}

function assertHttps(value: string, label: string) {
  if (!/^https:\/\//i.test(value)) throw new Error(`${label} must use HTTPS`);
}

function resultCode(xml: string) {
  return tag(xml, "result") || tag(xml, "responseCode") || tag(xml, "status");
}

async function relayRequest(xml: string) {
  const endpoint = required("HYP_RELAY_URL");
  assertHttps(endpoint, "HYP_RELAY_URL");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Atlas-One-HYP/1.0",
    },
    body: new URLSearchParams({
      user: required("HYP_API_KEY"),
      password: required("HYP_PASSP"),
      int_in: xml,
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const responseXml = (await response.text()).trim();
  if (!response.ok) throw new Error(`HYP Relay HTTP ${response.status}`);

  const code = resultCode(responseXml);
  if (code !== "000" && code !== "0") {
    const message = tag(responseXml, "userMessage") || tag(responseXml, "message") || "Unknown HYP error";
    throw new Error(`HYP ${code || "UNKNOWN"}: ${message}`);
  }

  return responseXml;
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

export async function createHypPaymentLink(input: HypPaymentLinkInput) {
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Некорректная сумма оплаты");
  assertHttps(input.returnUrl, "HYP return URL");

  const totalMinor = Math.round(input.amountIls * 100);
  const uniqueId = safeText(input.orderId, 64);
  if (!uniqueId) throw new Error("HYP order ID is required");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ashrait>
  <request>
    <version>2000</version>
    <language>${input.language || "HEB"}</language>
    <command>doDeal</command>
    <doDeal>
      <terminalNumber>${xmlText(required("HYP_MASOF"))}</terminalNumber>
      <cardNo>CGMPI</cardNo>
      <total>${totalMinor}</total>
      <transactionType>Debit</transactionType>
      <creditType>RegularCredit</creditType>
      <currency>ILS</currency>
      <transactionCode>Internet</transactionCode>
      <validation>TxnSetup</validation>
      <mid>${xmlText(required("HYP_MID"))}</mid>
      <uniqueid>${xmlText(uniqueId)}</uniqueid>
      <mpiValidation>AutoComm</mpiValidation>
      <successUrl>${xmlText(input.returnUrl)}</successUrl>
      <errorUrl>${xmlText(input.returnUrl)}</errorUrl>
      <cancelUrl>${xmlText(input.returnUrl)}</cancelUrl>
      <customerData>
        <customerName>${xmlText(safeText(input.customerName || "Atlas Customer", 100))}</customerName>
        <email>${xmlText(safeText(input.customerEmail || "", 120))}</email>
        <phoneNumber>${xmlText(safeText(input.customerPhone || "", 30))}</phoneNumber>
      </customerData>
      <description>${xmlText(safeText(input.description, 120))}</description>
    </doDeal>
  </request>
</ashrait>`;

  console.info("hyp.payment_page.request", {
    orderId: uniqueId,
    amountMinor: totalMinor,
    terminalConfigured: true,
    midConfigured: true,
    relayConfigured: true,
  });

  const responseXml = await relayRequest(xml);
  const paymentUrl = tag(responseXml, "mpiHostedPageUrl");
  if (!paymentUrl) throw new Error("HYP response does not contain mpiHostedPageUrl");
  assertHttps(paymentUrl, "HYP payment page URL");

  console.info("hyp.payment_page.created", {
    orderId: uniqueId,
    tranId: tag(responseXml, "tranId") || undefined,
  });

  return paymentUrl;
}

export function hypResultFromUrl(url: URL) {
  const raw = Object.fromEntries(url.searchParams.entries());
  const code = url.searchParams.get("responseCode") || url.searchParams.get("result") || url.searchParams.get("status") || "";
  return {
    success: code === "000" || code === "0",
    code,
    orderId: url.searchParams.get("uniqueID") || url.searchParams.get("uniqueId") || "",
    transactionId: url.searchParams.get("cgUid") || url.searchParams.get("tranId") || "",
    cgUid: url.searchParams.get("cgUid") || "",
    tranId: url.searchParams.get("tranId") || "",
    txId: url.searchParams.get("txId") || "",
    amount: url.searchParams.get("total") || url.searchParams.get("amount") || "",
    cardMask: url.searchParams.get("cardMask") || "",
    raw,
  };
}

async function inquirePayment(url: URL) {
  const txId = url.searchParams.get("txId") || "";
  if (!txId) return false;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ashrait>
  <request>
    <version>2000</version>
    <language>ENG</language>
    <command>inquireTransactions</command>
    <inquireTransactions>
      <terminalNumber>${xmlText(required("HYP_MASOF"))}</terminalNumber>
      <queryName>mpiTransaction</queryName>
      <mid>${xmlText(required("HYP_MID"))}</mid>
      <mpiTransactionId>${xmlText(txId)}</mpiTransactionId>
    </inquireTransactions>
  </request>
</ashrait>`;

  const responseXml = await relayRequest(xml);
  const expectedOrderId = url.searchParams.get("uniqueID") || url.searchParams.get("uniqueId") || "";
  const actualOrderId = tag(responseXml, "uniqueid");
  const expectedCgUid = url.searchParams.get("cgUid") || "";
  const actualCgUid = tag(responseXml, "cgUid");

  return Boolean(expectedOrderId && actualOrderId === expectedOrderId && expectedCgUid && actualCgUid === expectedCgUid);
}

export async function verifyHypCallback(url: URL) {
  const result = hypResultFromUrl(url);
  if (!result.success || !result.orderId || !result.cgUid || !result.txId) return false;

  try {
    const verified = await inquirePayment(url);
    console.info("hyp.callback.verified", {
      orderId: result.orderId,
      txId: result.txId,
      verified,
    });
    return verified;
  } catch (error) {
    console.error("hyp.callback.verification_failed", {
      orderId: result.orderId,
      txId: result.txId,
      message: error instanceof Error ? error.message : "Unknown verification error",
    });
    return false;
  }
}

export async function refundHypDeal(input: { transactionId: string; amountMinor?: number }) {
  const transactionId = input.transactionId.trim();
  if (!transactionId) throw new Error("Не найден cgUid транзакции HYP");
  if (input.amountMinor !== undefined && (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0)) {
    throw new Error("Некорректная сумма возврата");
  }

  const total = input.amountMinor === undefined ? "" : `<total>${input.amountMinor}</total>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ashrait>
  <request>
    <version>2000</version>
    <language>ENG</language>
    <command>refundDeal</command>
    <refundDeal>
      <terminalNumber>${xmlText(required("HYP_MASOF"))}</terminalNumber>
      <cgUid>${xmlText(transactionId)}</cgUid>
      ${total}
    </refundDeal>
  </request>
</ashrait>`;

  const responseXml = await relayRequest(xml);
  const refundTranId = tag(responseXml, "tranId");
  if (!refundTranId) throw new Error("HYP refund response does not contain tranId");

  console.info("hyp.refund.accepted", {
    sourceCgUid: transactionId,
    refundTranId,
    amountMinor: input.amountMinor ?? "full",
  });

  return {
    code: resultCode(responseXml),
    message: "Refund accepted",
    transactionId: refundTranId,
  };
}
