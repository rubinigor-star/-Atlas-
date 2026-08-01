import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

const schema = z.object({
  active: z.boolean(),
  abandonAfterMinutes: z.number().int().min(1).max(240),
  firstEmailAfterMinutes: z.number().int().min(0).max(240),
  finalEmailAfterMinutes: z.number().int().min(1).max(10080),
});

async function scenario(organizationId: string) {
  await ensureAbandonedCheckoutRuntime();
  return db.$queryRawUnsafe<Array<{ id:string; active:boolean; abandonAfterMinutes:number; firstDelay:number; finalDelay:number }>>(`SELECT s."id",s."active",s."abandonAfterMinutes",COALESCE(MAX(CASE WHEN st."position"=1 THEN st."delayMinutes" END),0)::int AS "firstDelay",COALESCE(MAX(CASE WHEN st."position"=2 THEN st."delayMinutes" END),1440)::int AS "finalDelay" FROM "RecoveryScenario" s LEFT JOIN "RecoveryScenarioStep" st ON st."scenarioId"=s."id" WHERE s."organizationId"=$1 AND s."eventId" IS NULL GROUP BY s."id",s."active",s."abandonAfterMinutes" ORDER BY s."createdAt" ASC LIMIT 1`, organizationId);
}

export async function GET() {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const rows = await scenario(staff.organizationId!);
  const current = rows[0];
  return NextResponse.json({
    active: current?.active ?? true,
    abandonAfterMinutes: current?.abandonAfterMinutes ?? 30,
    firstEmailAfterMinutes: current?.firstDelay ?? 0,
    finalEmailAfterMinutes: current?.finalDelay ?? 1440,
  }, { headers:{"cache-control":"no-store"} });
}

export async function PUT(request: Request) {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const input = schema.parse(await request.json());
  const rows = await scenario(staff.organizationId!);
  const current = rows[0];
  if (!current) return NextResponse.json({ error:"SCENARIO_NOT_INITIALIZED" },{status:409});
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`UPDATE "RecoveryScenario" SET "active"=$2,"abandonAfterMinutes"=$3,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, current.id, input.active, input.abandonAfterMinutes);
    await tx.$executeRawUnsafe(`UPDATE "RecoveryScenarioStep" SET "delayMinutes"=$2 WHERE "scenarioId"=$1 AND "position"=1`, current.id, input.firstEmailAfterMinutes);
    await tx.$executeRawUnsafe(`UPDATE "RecoveryScenarioStep" SET "delayMinutes"=$2 WHERE "scenarioId"=$1 AND "position"=2`, current.id, input.finalEmailAfterMinutes);
  });
  return NextResponse.json({ ok:true, ...input });
}
