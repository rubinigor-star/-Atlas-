import { NextResponse } from "next/server";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";

export const dynamic = "force-dynamic";

const CANONICAL_APP_URL = "https://www.atlas-one.co";

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function redactPaymentUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  for (const key of ["PassP", "signature", "KEY", "password", "APIKey", "apiKey"]) {
    if (url.searchParams.has(key)) url.searchParams.set(key, "[REDACTED]");
  }
  return {
    endpoint: `${url.origin}${url.pathname}`,
    action: url.searchParams.get("action") || "",
    masof: url.searchParams.get("Masof") || "",
    amount: url.searchParams.get("Amount") || "",
    currency: url.searchParams.get("Coin") || "",
    order: url.searchParams.get("Order") || "",
    successUrl: url.searchParams.get("SuccessUrl") || "",
    errorUrl: url.searchParams.get("ErrorUrl") || "",
    cancelUrl: url.searchParams.get("CancelUrl") || "",
    pageLang: url.searchParams.get("PageLang") || "",
    hasPassP: Boolean(url.searchParams.get("PassP")),
    hasSignature: Boolean(url.searchParams.get("signature")),
    safeUrl: url.toString(),
  };
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const orderId = `ATLAS-TEST-${Date.now()}`;

  console.info("hyp_test_started", {
    orderId,
    requestHost: requestUrl.host,
    integrationMode: process.env.HYP_INTEGRATION_MODE?.trim() || "legacy-default",
    env: {
      HYP_MASOF: envPresent("HYP_MASOF"),
      HYP_API_KEY: envPresent("HYP_API_KEY"),
      HYP_PASSP: envPresent("HYP_PASSP"),
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL?.trim() || null,
    },
  });

  try {
    const returnUrl = `${CANONICAL_APP_URL}/payments/hyp/result?atlasOrder=${encodeURIComponent(orderId)}`;
    const paymentUrl = await createHypPaymentLink({
      amountIls: 1,
      orderId,
      description: "Atlas One payment integration test",
      customerName: "Atlas Test Customer",
      returnUrl,
      language: "HEB",
    });

    console.info("hyp_test_payment_url_created", redactPaymentUrl(paymentUrl));

    const launchUrl = `${CANONICAL_APP_URL}/payments/hyp/launch?target=${encodeURIComponent(paymentUrl)}`;
    console.info("hyp_test_redirecting", {
      orderId,
      launchOrigin: CANONICAL_APP_URL,
      returnUrl,
    });

    return NextResponse.redirect(launchUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Hyp payment page";
    console.error("hyp_test_failed", {
      orderId,
      message,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    const target = new URL("/payments/hyp/test", CANONICAL_APP_URL);
    target.searchParams.set("error", message.slice(0, 500));
    return NextResponse.redirect(target, 303);
  }
}
