import { NextResponse } from "next/server";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";

export const dynamic = "force-dynamic";

const CANONICAL_APP_URL = "https://www.atlas-one.co";

export async function GET() {
  const orderId = `ATLAS-TEST-${Date.now()}`;

  try {
    const returnUrl = `${CANONICAL_APP_URL}/payments/hyp/result?atlasOrder=${encodeURIComponent(orderId)}`;
    const paymentUrl = await createHypPaymentLink({
      amountIls: 1,
      orderId,
      description: "Atlas One HYP integration test",
      customerName: "Atlas Test Customer",
      customerEmail: "",
      customerPhone: "",
      returnUrl,
      language: "HEB",
    });

    console.info("hyp.test.redirect", {
      orderId,
      amountIls: 1,
      paymentHost: new URL(paymentUrl).host,
      returnUrl,
    });

    return NextResponse.redirect(paymentUrl, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown HYP payment test error";
    console.error("hyp.test.failed", { orderId, message });

    return NextResponse.json(
      {
        ok: false,
        orderId,
        error: message,
      },
      { status: 500 },
    );
  }
}
