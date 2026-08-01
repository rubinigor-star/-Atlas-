import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { completeRecoveryAction, getDueRecoveryActions, prepareRecoveryActions } from "@/lib/abandoned-checkout";
import { refreshAbandonedCheckoutStatuses } from "@/lib/abandoned-maintenance";
import { recoveryChannel } from "@/lib/recovery-channels";

export async function POST(request: Request) {
  await requirePermission("ANALYTICS_VIEW");
  const newlyAbandoned = await refreshAbandonedCheckoutStatuses();
  await prepareRecoveryActions();
  const actions = await getDueRecoveryActions(50);
  const origin = new URL(request.url).origin.replace(/\/$/, "");
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const action of actions) {
    const adapter = recoveryChannel(action.channel);
    if (!adapter.configured() || !action.customerEmail) {
      await completeRecoveryAction(action.id, {
        status: "SKIPPED",
        error: !action.customerEmail ? "RECIPIENT_MISSING" : "CHANNEL_NOT_CONFIGURED",
      });
      skipped++;
      continue;
    }

    try {
      const result = await adapter.send({
        recipient: action.customerEmail,
        firstName: action.customerFirstName,
        eventTitle: action.eventTitle,
        checkoutUrl: action.checkoutUrl,
        optOutUrl: `${origin}/api/checkout/abandon/opt-out?token=${encodeURIComponent(action.token)}`,
        amountMinor: action.amountMinor,
        templateKey: action.templateKey,
      });
      await completeRecoveryAction(action.id, { status: "SENT", providerId: result.id });
      sent++;
    } catch (error) {
      await completeRecoveryAction(action.id, {
        status: "FAILED",
        error: error instanceof Error ? error.message : "DELIVERY_FAILED",
      });
      failed++;
    }
  }

  return NextResponse.json({ ok: true, newlyAbandoned, processed: actions.length, sent, failed, skipped });
}
