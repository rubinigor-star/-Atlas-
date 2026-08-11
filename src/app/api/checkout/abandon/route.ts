import { NextResponse } from "next/server";
import { z } from "zod";
import { abandonStages, captureAbandonedCheckout } from "@/lib/abandoned-checkout";
import { touchAbandonedCheckoutContext } from "@/lib/abandoned-order-attribution";
import { capturePromoterCheckoutV2 } from "@/lib/promoter-v2-checkout";

const schema = z.object({
  token: z.string().uuid(),
  eventId: z.string().min(1),
  categoryId: z.string().min(1).nullable().optional(),
  quantity: z.number().int().min(1).max(20),
  amountMinor: z.number().int().min(0).max(100000000),
  stage: z.enum(abandonStages),
  checkoutUrl: z.string().url().max(2000),
  customer: z.object({
    firstName: z.string().max(80).optional(),
    lastName: z.string().max(80).optional(),
    email: z.string().max(160).optional(),
    phone: z.string().max(30).optional(),
  }).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await captureAbandonedCheckout(input);
    const referralCode = typeof input.metadata?.referralCode === "string" ? input.metadata.referralCode : null;
    await Promise.all([
      touchAbandonedCheckoutContext(input.token, input.eventId, referralCode),
      capturePromoterCheckoutV2({token:input.token,eventId:input.eventId,referralCode,stage:input.stage,amountMinor:input.amountMinor,quantity:input.quantity}),
    ]);
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_CAPTURE";
    return NextResponse.json({ error: message }, { status: message === "EVENT_UNAVAILABLE" ? 404 : 400 });
  }
}
