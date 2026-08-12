import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { db } from "@/lib/db";
import { completeRecoveryAction, ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";
import { recoveryCheckoutUrl } from "@/lib/abandoned-order-attribution";
import { recoveryChannel } from "@/lib/recovery-channels";

type ActionRow = {
  id: string;
  checkoutId: string;
  scenarioStepId: string;
  channel: string;
  templateKey: string;
  customerEmail: string | null;
  customerFirstName: string | null;
  eventTitle: string;
  checkoutUrl: string;
  amountMinor: number;
  token: string;
};

async function refreshOrganization(organizationId: string) {
  await ensureAbandonedCheckoutRuntime();
  const updated = await db.$queryRawUnsafe<Array<{ id: string }>>(
    `UPDATE "AbandonedCheckout" c
     SET "abandonedAt"=COALESCE(c."abandonedAt",c."lastActivityAt"),"updatedAt"=CURRENT_TIMESTAMP
     WHERE c."organizationId"=$1
       AND c."status"='ACTIVE'
       AND c."abandonedAt" IS NULL
       AND c."optOutAt" IS NULL
       AND EXISTS (
         SELECT 1 FROM "RecoveryScenario" s
         WHERE s."active"=TRUE
           AND s."organizationId"=c."organizationId"
           AND (s."eventId"=c."eventId" OR s."eventId" IS NULL)
           AND c."lastActivityAt" <= CURRENT_TIMESTAMP - make_interval(mins => s."abandonAfterMinutes")
       )
     RETURNING c."id"`,
    organizationId,
  );
  return updated.length;
}

async function prepareOrganizationActions(organizationId: string) {
  await ensureAbandonedCheckoutRuntime();
  const abandoned = await db.$queryRawUnsafe<Array<{ id: string; eventId: string; abandonedAt: Date }>>(
    `SELECT "id","eventId","abandonedAt"
     FROM "AbandonedCheckout"
     WHERE "organizationId"=$1
       AND "status"='ACTIVE'
       AND "optOutAt" IS NULL
       AND "abandonedAt" IS NOT NULL
       AND "customerEmail" IS NOT NULL`,
    organizationId,
  );

  for (const checkout of abandoned) {
    const scenarios = await db.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "RecoveryScenario"
       WHERE "active"=TRUE
         AND "organizationId"=$1
         AND ("eventId"=$2 OR "eventId" IS NULL)
       ORDER BY CASE WHEN "eventId" IS NULL THEN 1 ELSE 0 END,"createdAt" ASC
       LIMIT 1`,
      organizationId,
      checkout.eventId,
    );
    const scenarioId = scenarios[0]?.id;
    if (!scenarioId) continue;

    const steps = await db.$queryRawUnsafe<Array<{ id: string; channel: string; delayMinutes: number }>>(
      `SELECT "id","channel","delayMinutes" FROM "RecoveryScenarioStep" WHERE "scenarioId"=$1 ORDER BY "position" ASC`,
      scenarioId,
    );

    for (const step of steps) {
      const scheduledAt = new Date(new Date(checkout.abandonedAt).getTime() + step.delayMinutes * 60000);
      await db.$executeRawUnsafe(
        `INSERT INTO "RecoveryAction" ("id","checkoutId","scenarioStepId","channel","scheduledAt")
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT ("checkoutId","scenarioStepId") DO NOTHING`,
        randomUUID(),
        checkout.id,
        step.id,
        step.channel,
        scheduledAt,
      );
    }
  }
}

async function dueOrganizationActions(organizationId: string, limit = 50) {
  await ensureAbandonedCheckoutRuntime();
  return db.$queryRawUnsafe<ActionRow[]>(
    `SELECT a."id",a."checkoutId",a."scenarioStepId",a."channel",s."templateKey",
            c."customerEmail",c."customerFirstName",e."title" AS "eventTitle",
            c."checkoutUrl",c."amountMinor",c."token"
     FROM "RecoveryAction" a
     JOIN "RecoveryScenarioStep" s ON s."id"=a."scenarioStepId"
     JOIN "AbandonedCheckout" c ON c."id"=a."checkoutId"
     JOIN "Event" e ON e."id"=c."eventId"
     WHERE c."organizationId"=$1
       AND a."status"='PENDING'
       AND a."scheduledAt"<=CURRENT_TIMESTAMP
       AND c."status"='ACTIVE'
       AND c."optOutAt" IS NULL
     ORDER BY a."scheduledAt" ASC
     LIMIT $2`,
    organizationId,
    limit,
  );
}

export async function POST(request: Request) {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const organizationId = staff.organizationId;
  if (!organizationId) return NextResponse.json({ error: "ORGANIZATION_REQUIRED" }, { status: 403 });

  const newlyAbandoned = await refreshOrganization(organizationId);
  await prepareOrganizationActions(organizationId);
  const actions = await dueOrganizationActions(organizationId, 50);
  const origin = new URL(request.url).origin.replace(/\/$/, "");
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const skipReasons: Record<string, number> = {};
  const failureReasons: Record<string, number> = {};

  for (const action of actions) {
    const adapter = recoveryChannel(action.channel);
    if (!adapter.configured() || !action.customerEmail) {
      const reason = !action.customerEmail ? "RECIPIENT_MISSING" : "CHANNEL_NOT_CONFIGURED";
      await completeRecoveryAction(action.id, { status: "SKIPPED", error: reason });
      skipReasons[reason] = (skipReasons[reason] || 0) + 1;
      skipped++;
      continue;
    }

    try {
      const result = await adapter.send({
        recipient: action.customerEmail,
        firstName: action.customerFirstName,
        eventTitle: action.eventTitle,
        checkoutUrl: recoveryCheckoutUrl(action.checkoutUrl, action.token),
        optOutUrl: `${origin}/api/checkout/abandon/opt-out?token=${encodeURIComponent(action.token)}`,
        amountMinor: action.amountMinor,
        templateKey: action.templateKey,
      });
      await completeRecoveryAction(action.id, { status: "SENT", providerId: result.id });
      sent++;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "DELIVERY_FAILED";
      await completeRecoveryAction(action.id, { status: "FAILED", error: reason });
      failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      failed++;
    }
  }

  console.info("abandoned.run_now.completed", { organizationId, newlyAbandoned, processed: actions.length, sent, failed, skipped });

  return NextResponse.json({
    ok: true,
    newlyAbandoned,
    processed: actions.length,
    sent,
    failed,
    skipped,
    skipReasons: Object.keys(skipReasons).length ? skipReasons : undefined,
    failureReasons: Object.keys(failureReasons).length ? failureReasons : undefined,
  });
}
