import { NextResponse } from "next/server";
import { completeRecoveryAction, getDueRecoveryActions, prepareRecoveryActions } from "@/lib/abandoned-checkout";
import { recoveryCheckoutUrl } from "@/lib/abandoned-order-attribution";
import { recoveryChannel } from "@/lib/recovery-channels";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function baseUrl(request: Request) {
  return new URL(request.url).origin.replace(/\/$/, "");
}

async function run(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  await prepareRecoveryActions();
  const actions = await getDueRecoveryActions(50);
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const action of actions) {
    const adapter = recoveryChannel(action.channel);
    if (!adapter.configured()) {
      await completeRecoveryAction(action.id, { status: "SKIPPED", error: "CHANNEL_NOT_CONFIGURED" });
      skipped++;
      continue;
    }
    if (!action.customerEmail) {
      await completeRecoveryAction(action.id, { status: "SKIPPED", error: "RECIPIENT_MISSING" });
      skipped++;
      continue;
    }
    try {
      const checkoutUrl = recoveryCheckoutUrl(action.checkoutUrl, action.token);
      const result = await adapter.send({ recipient: action.customerEmail, firstName: action.customerFirstName, eventTitle: action.eventTitle, checkoutUrl, optOutUrl: `${baseUrl(request)}/api/checkout/abandon/opt-out?token=${encodeURIComponent(action.token)}`, amountMinor: action.amountMinor, templateKey: action.templateKey });
      await completeRecoveryAction(action.id, { status: "SENT", providerId: result.id });
      sent++;
    } catch (error) {
      await completeRecoveryAction(action.id, { status: "FAILED", error: error instanceof Error ? error.message : "DELIVERY_FAILED" });
      failed++;
    }
  }
  return NextResponse.json({ ok: true, processed: actions.length, sent, failed, skipped });
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
