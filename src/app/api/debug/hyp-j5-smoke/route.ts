import { NextResponse } from "next/server";
import { createHypPaymentLink } from "@/lib/hyp-yaadpay";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const paymentUrl = await createHypPaymentLink({
      amountIls: 1,
      orderId: `SMOKE-J5-${Date.now()}`,
      description: "Atlas J5 smoke test",
      customerName: "Atlas Smoke",
      customerEmail: "smoke@atlas-one.co",
      customerPhone: "0500000000",
      returnUrl: "https://www.atlas-one.co/api/payments/hyp/approval",
      language: "ENG",
      authorizationOnly: true,
    });
    const url = new URL(paymentUrl);
    return NextResponse.json({
      ok: true,
      provider: url.hostname,
      action: url.searchParams.get("action"),
      j5: url.searchParams.get("J5"),
      hasSignature: Boolean(url.searchParams.get("signature")),
      callback: url.searchParams.get("ReturnUrl") || null,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown HYP smoke-test error",
    }, { status: 500 });
  }
}
