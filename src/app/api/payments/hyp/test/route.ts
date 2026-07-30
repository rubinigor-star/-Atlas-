import { NextResponse } from "next/server";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";

export const dynamic = "force-dynamic";

const CANONICAL_APP_URL = "https://www.atlas-one.co";

export async function GET(request: Request) {
  try {
    const orderId = `ATLAS-TEST-${Date.now()}`;
    const returnUrl = `${CANONICAL_APP_URL}/payments/hyp/result?atlasOrder=${encodeURIComponent(orderId)}`;
    const paymentUrl = await createHypPaymentLink({
      amountIls: 1,
      orderId,
      description: "Atlas One payment integration test",
      customerName: "Atlas Test Customer",
      returnUrl,
      language: "HEB",
    });
    const launchUrl = `${CANONICAL_APP_URL}/payments/hyp/launch?target=${encodeURIComponent(paymentUrl)}`;
    return NextResponse.redirect(launchUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Hyp payment page";
    const target = new URL("/payments/hyp/test", CANONICAL_APP_URL);
    target.searchParams.set("error", message.slice(0, 500));
    return NextResponse.redirect(target, 303);
  }
}
