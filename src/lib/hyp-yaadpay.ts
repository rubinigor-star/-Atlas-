const HYP_SIGN_URL = "https://pay.hyp.co.il/p/";

function required(name: "HYP_MASOF" | "HYP_API_KEY") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function safeText(value: string, max = 120) {
  return value.replace(/[<>\r\n]/g, " ").trim().slice(0, max);
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
  if (!Number.isFinite(input.amountIls) || input.amountIls <= 0) throw new Error("Invalid payment amount");
  if (!/^https:\/\//i.test(input.returnUrl)) throw new Error("Hyp return URL must use HTTPS");

  const masof = required("HYP_MASOF");
  const apiKey = required("HYP_API_KEY");
  const nameParts = safeText(input.customerName || "Atlas Test Customer", 80).split(/\s+/);
  const firstName = nameParts.shift() || "Atlas";
  const lastName = nameParts.join(" ") || "Customer";

  const paymentParams = new URLSearchParams({
    action: "pay",
    Masof: masof,
    Amount: input.amountIls.toFixed(2),
    Coin: "1",
    Info: safeText(input.description),
    Order: safeText(input.orderId, 64),
    ClientName: firstName,
    ClientLName: lastName,
    email: safeText(input.customerEmail || "payments@atlas-one.co", 120),
    cell: safeText(input.customerPhone || "", 30),
    PageLang: input.language || "HEB",
    UTF8: "True",
    UTF8out: "True",
    MoreData: "True",
    Sign: "True",
    Tash: "1",
    FixTash: "True",
    sendemail: "False",
    SendHesh: "False",
    Postpone: "False",
    tmp: "1",
    SuccessUrl: input.returnUrl,
    ErrorUrl: input.returnUrl,
    ReturnUrl: input.returnUrl,
  });

  const signRequest = new URLSearchParams(paymentParams);
  signRequest.set("action", "APISign");
  signRequest.set("What", "SIGN");
  signRequest.set("KEY", apiKey);

  const response = await fetch(`${HYP_SIGN_URL}?${signRequest.toString()}`, {
    method: "GET",
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });
  const body = (await response.text()).trim();
  if (!response.ok) throw new Error(`Hyp signing service returned HTTP ${response.status}`);
  if (!body || /error|שגיאה/i.test(body)) throw new Error(`Hyp signing failed: ${body.slice(0, 180) || "empty response"}`);

  // The legacy YaadPay signing API returns a signed query string. Never expose the API key.
  const signedQuery = body.replace(/^\?/, "");
  const signed = new URLSearchParams(signedQuery);
  if (!signed.get("signature") && !signed.get("Signature")) {
    throw new Error(`Hyp signing response did not contain a signature: ${body.slice(0, 180)}`);
  }
  signed.delete("KEY");
  signed.set("action", "pay");
  return `${HYP_SIGN_URL}?${signed.toString()}`;
}

export function hypResultFromUrl(url: URL) {
  const params = Object.fromEntries(url.searchParams.entries());
  const code = url.searchParams.get("CCode") || url.searchParams.get("code") || url.searchParams.get("errorCode") || "";
  const success = code === "0" || code === "000" || url.searchParams.get("status")?.toLowerCase() === "success";
  return {
    success,
    code,
    orderId: url.searchParams.get("Order") || url.searchParams.get("order") || "",
    transactionId: url.searchParams.get("Id") || url.searchParams.get("ACode") || url.searchParams.get("txId") || "",
    amount: url.searchParams.get("Amount") || url.searchParams.get("amount") || "",
    cardMask: url.searchParams.get("L4digit") || url.searchParams.get("cardMask") || "",
    raw: params,
  };
}
