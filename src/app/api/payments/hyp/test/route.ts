import { NextResponse } from "next/server";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";

export const dynamic = "force-dynamic";

function appUrl(request: Request) {
  return (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export async function GET(request: Request) {
  try {
    const orderId = `ATLAS-TEST-${Date.now()}`;
    const returnUrl = `${appUrl(request)}/payments/hyp/result?atlasOrder=${encodeURIComponent(orderId)}`;
    const paymentUrl = await createHypPaymentLink({
      amountIls: 1,
      orderId,
      description: "Atlas One payment integration test",
      customerName: "Atlas Test Customer",
      returnUrl,
      language: "HEB",
    });
    return NextResponse.redirect(paymentUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create Hyp payment page";
    const target = new URL("/payments/hyp/test", request.url);
    target.searchParams.set("error", message.slice(0, 500));
    return NextResponse.redirect(target, 303);
  }
}
