import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";

export const abandonStages = ["CHECKOUT_OPENED", "CONTACTS_ENTERED", "PAYMENT_STARTED"] as const;
export type AbandonStage = (typeof abandonStages)[number];

type CaptureInput = {
  token: string;
  eventId: string;
  categoryId?: string | null;
  quantity: number;
  amountMinor: number;
  stage: AbandonStage;
  checkoutUrl: string;
  customer?: { firstName?: string; lastName?: string; email?: string; phone?: string };
  metadata?: Record<string, unknown>;
};

type CheckoutRow = {
  id: string;
  token: string;
  organizationId: string;
  eventId: string;
  eventTitle: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  quantity: number;
  amountMinor: number;
  stage: string;
  status: string;
  checkoutUrl: string;
  lastActivityAt: Date;
  abandonedAt: Date | null;
  recoveredAt: Date | null;
};

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
};

let initialized: Promise<void> | undefined;

export function ensureAbandonedCheckoutRuntime() {
  if (!initialized) initialized = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS "AbandonedCheckout" ("id" TEXT PRIMARY KEY,"token" TEXT NOT NULL UNIQUE,"organizationId" TEXT NOT NULL,"eventId" TEXT NOT NULL,"categoryId" TEXT,"customerFirstName" TEXT,"customerLastName" TEXT,"customerEmail" TEXT,"customerPhone" TEXT,"quantity" INTEGER NOT NULL DEFAULT 1,"amountMinor" INTEGER NOT NULL DEFAULT 0,"currency" TEXT NOT NULL DEFAULT 'ILS',"stage" TEXT NOT NULL DEFAULT 'CHECKOUT_OPENED',"status" TEXT NOT NULL DEFAULT 'ACTIVE',"checkoutUrl" TEXT NOT NULL,"orderId" TEXT,"metadataJson" TEXT,"lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"abandonedAt" TIMESTAMP(3),"recoveredAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS "AbandonedCheckout_org_status_idx" ON "AbandonedCheckout"("organizationId","status","lastActivityAt")`,
      `CREATE INDEX IF NOT EXISTS "AbandonedCheckout_event_status_idx" ON "AbandonedCheckout"("eventId","status","lastActivityAt")`,
      `CREATE TABLE IF NOT EXISTS "RecoveryScenario" ("id" TEXT PRIMARY KEY,"organizationId" TEXT,"eventId" TEXT,"name" TEXT NOT NULL,"active" BOOLEAN NOT NULL DEFAULT TRUE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS "RecoveryScenarioStep" ("id" TEXT PRIMARY KEY,"scenarioId" TEXT NOT NULL,"position" INTEGER NOT NULL,"delayMinutes" INTEGER NOT NULL,"channel" TEXT NOT NULL,"templateKey" TEXT NOT NULL,"stopOnConversion" BOOLEAN NOT NULL DEFAULT TRUE,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY ("scenarioId") REFERENCES "RecoveryScenario"("id") ON DELETE CASCADE,UNIQUE("scenarioId","position"))`,
      `CREATE TABLE IF NOT EXISTS "RecoveryAction" ("id" TEXT PRIMARY KEY,"checkoutId" TEXT NOT NULL,"scenarioStepId" TEXT NOT NULL,"channel" TEXT NOT NULL,"status" TEXT NOT NULL DEFAULT 'PENDING',"scheduledAt" TIMESTAMP(3) NOT NULL,"sentAt" TIMESTAMP(3),"providerId" TEXT,"error" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY ("checkoutId") REFERENCES "AbandonedCheckout"("id") ON DELETE CASCADE,FOREIGN KEY ("scenarioStepId") REFERENCES "RecoveryScenarioStep"("id") ON DELETE CASCADE,UNIQUE("checkoutId","scenarioStepId"))`,
      `CREATE INDEX IF NOT EXISTS "RecoveryAction_due_idx" ON "RecoveryAction"("status","scheduledAt")`,
      `CREATE TABLE IF NOT EXISTS "RecoveryChannel" ("code" TEXT PRIMARY KEY,"provider" TEXT,"enabled" BOOLEAN NOT NULL DEFAULT FALSE,"configured" BOOLEAN NOT NULL DEFAULT FALSE,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
      `INSERT INTO "RecoveryChannel" ("code","provider","enabled","configured") VALUES ('EMAIL','RESEND',TRUE,FALSE),('SMS',NULL,FALSE,FALSE),('WHATSAPP',NULL,FALSE,FALSE) ON CONFLICT ("code") DO NOTHING`,
    ];
    for (const statement of statements) await db.$executeRawUnsafe(statement);
  })().catch(error => { initialized = undefined; throw error; });
  return initialized;
}

async function ensureDefaultScenario(organizationId: string) {
  await ensureAbandonedCheckoutRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "RecoveryScenario" WHERE "organizationId"=$1 AND "eventId" IS NULL AND "active"=TRUE ORDER BY "createdAt" ASC LIMIT 1`, organizationId);
  if (rows[0]) return rows[0].id;
  const scenarioId = randomUUID();
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`INSERT INTO "RecoveryScenario" ("id","organizationId","name") VALUES ($1,$2,$3)`, scenarioId, organizationId, "Стандартное восстановление покупки");
    await tx.$executeRawUnsafe(`INSERT INTO "RecoveryScenarioStep" ("id","scenarioId","position","delayMinutes","channel","templateKey") VALUES ($1,$2,1,30,'EMAIL','FIRST_REMINDER'),($3,$2,2,1440,'EMAIL','FINAL_REMINDER')`, randomUUID(), scenarioId, randomUUID());
  });
  return scenarioId;
}

export async function captureAbandonedCheckout(input: CaptureInput) {
  await ensureAbandonedCheckoutRuntime();
  const event = await db.event.findUnique({ where: { id: input.eventId }, select: { organizationId: true, status: true } });
  if (!event || event.status !== "PUBLISHED") throw new Error("EVENT_UNAVAILABLE");
  const customer = input.customer || {};
  await db.$executeRawUnsafe(`INSERT INTO "AbandonedCheckout" ("id","token","organizationId","eventId","categoryId","customerFirstName","customerLastName","customerEmail","customerPhone","quantity","amountMinor","stage","checkoutUrl","metadataJson","lastActivityAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("token") DO UPDATE SET "categoryId"=EXCLUDED."categoryId","customerFirstName"=COALESCE(NULLIF(EXCLUDED."customerFirstName",''),"AbandonedCheckout"."customerFirstName"),"customerLastName"=COALESCE(NULLIF(EXCLUDED."customerLastName",''),"AbandonedCheckout"."customerLastName"),"customerEmail"=COALESCE(NULLIF(EXCLUDED."customerEmail",''),"AbandonedCheckout"."customerEmail"),"customerPhone"=COALESCE(NULLIF(EXCLUDED."customerPhone",''),"AbandonedCheckout"."customerPhone"),"quantity"=EXCLUDED."quantity","amountMinor"=EXCLUDED."amountMinor","stage"=EXCLUDED."stage","checkoutUrl"=EXCLUDED."checkoutUrl","metadataJson"=EXCLUDED."metadataJson","lastActivityAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP`, randomUUID(), input.token, event.organizationId, input.eventId, input.categoryId || null, customer.firstName || null, customer.lastName || null, customer.email?.trim().toLowerCase() || null, customer.phone || null, input.quantity, input.amountMinor, input.stage, input.checkoutUrl, JSON.stringify(input.metadata || {}));
  await ensureDefaultScenario(event.organizationId);
}

export async function markAbandonedCheckoutRecovered(token: string | undefined, orderId: string) {
  if (!token) return;
  await ensureAbandonedCheckoutRuntime();
  await db.$executeRawUnsafe(`UPDATE "AbandonedCheckout" SET "status"='RECOVERED',"orderId"=$2,"recoveredAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "token"=$1 AND "status"<>'RECOVERED'`, token, orderId);
  await db.$executeRawUnsafe(`UPDATE "RecoveryAction" SET "status"='CANCELLED',"updatedAt"=CURRENT_TIMESTAMP WHERE "checkoutId" IN (SELECT "id" FROM "AbandonedCheckout" WHERE "token"=$1) AND "status"='PENDING'`, token);
}

export async function prepareRecoveryActions() {
  await ensureAbandonedCheckoutRuntime();
  await db.$executeRawUnsafe(`UPDATE "AbandonedCheckout" SET "abandonedAt"=COALESCE("abandonedAt","lastActivityAt"),"updatedAt"=CURRENT_TIMESTAMP WHERE "status"='ACTIVE' AND "customerEmail" IS NOT NULL AND "lastActivityAt" <= CURRENT_TIMESTAMP - INTERVAL '30 minutes'`);
  const abandoned = await db.$queryRawUnsafe<Array<{ id: string; organizationId: string; eventId: string; abandonedAt: Date }>>(`SELECT "id","organizationId","eventId","abandonedAt" FROM "AbandonedCheckout" WHERE "status"='ACTIVE' AND "abandonedAt" IS NOT NULL AND "customerEmail" IS NOT NULL`);
  for (const checkout of abandoned) {
    const scenarios = await db.$queryRawUnsafe<Array<{ id: string }>>(`SELECT "id" FROM "RecoveryScenario" WHERE "active"=TRUE AND "organizationId"=$1 AND ("eventId"=$2 OR "eventId" IS NULL) ORDER BY CASE WHEN "eventId" IS NULL THEN 1 ELSE 0 END,"createdAt" ASC LIMIT 1`, checkout.organizationId, checkout.eventId);
    const scenarioId = scenarios[0]?.id || await ensureDefaultScenario(checkout.organizationId);
    const steps = await db.$queryRawUnsafe<Array<{ id: string; channel: string; delayMinutes: number }>>(`SELECT "id","channel","delayMinutes" FROM "RecoveryScenarioStep" WHERE "scenarioId"=$1 ORDER BY "position" ASC`, scenarioId);
    for (const step of steps) {
      const scheduledAt = new Date(new Date(checkout.abandonedAt).getTime() + step.delayMinutes * 60000);
      await db.$executeRawUnsafe(`INSERT INTO "RecoveryAction" ("id","checkoutId","scenarioStepId","channel","scheduledAt") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("checkoutId","scenarioStepId") DO NOTHING`, randomUUID(), checkout.id, step.id, step.channel, scheduledAt);
    }
  }
}

export async function getDueRecoveryActions(limit = 50) {
  await ensureAbandonedCheckoutRuntime();
  return db.$queryRawUnsafe<ActionRow[]>(`SELECT a."id",a."checkoutId",a."scenarioStepId",a."channel",s."templateKey",c."customerEmail",c."customerFirstName",e."title" AS "eventTitle",c."checkoutUrl",c."amountMinor" FROM "RecoveryAction" a JOIN "RecoveryScenarioStep" s ON s."id"=a."scenarioStepId" JOIN "AbandonedCheckout" c ON c."id"=a."checkoutId" JOIN "Event" e ON e."id"=c."eventId" WHERE a."status"='PENDING' AND a."scheduledAt"<=CURRENT_TIMESTAMP AND c."status"='ACTIVE' ORDER BY a."scheduledAt" ASC LIMIT $1`, limit);
}

export async function completeRecoveryAction(id: string, result: { status: "SENT" | "FAILED" | "SKIPPED"; providerId?: string; error?: string }) {
  await db.$executeRawUnsafe(`UPDATE "RecoveryAction" SET "status"=$2,"sentAt"=CASE WHEN $2='SENT' THEN CURRENT_TIMESTAMP ELSE "sentAt" END,"providerId"=$3,"error"=$4,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, id, result.status, result.providerId || null, result.error || null);
}

export async function recoveryDashboard(organizationId: string, allowedEventIds?: string[]) {
  await ensureAbandonedCheckoutRuntime();
  const scope = allowedEventIds?.length ? ` AND c."eventId" = ANY($2::text[])` : "";
  const params: unknown[] = [organizationId]; if (allowedEventIds?.length) params.push(allowedEventIds);
  const totals = await db.$queryRawUnsafe<Array<{ activeCount: bigint; potentialMinor: bigint; recoveredCount: bigint; recoveredMinor: bigint }>>(`SELECT COUNT(*) FILTER (WHERE c."status"='ACTIVE' AND c."abandonedAt" IS NOT NULL) AS "activeCount",COALESCE(SUM(c."amountMinor") FILTER (WHERE c."status"='ACTIVE' AND c."abandonedAt" IS NOT NULL),0) AS "potentialMinor",COUNT(*) FILTER (WHERE c."status"='RECOVERED') AS "recoveredCount",COALESCE(SUM(c."amountMinor") FILTER (WHERE c."status"='RECOVERED'),0) AS "recoveredMinor" FROM "AbandonedCheckout" c WHERE c."organizationId"=$1${scope}`, ...params);
  const events = await db.$queryRawUnsafe<Array<{ eventId: string; title: string; activeCount: bigint; potentialMinor: bigint; recoveredCount: bigint; recoveredMinor: bigint }>>(`SELECT c."eventId",e."title",COUNT(*) FILTER (WHERE c."status"='ACTIVE' AND c."abandonedAt" IS NOT NULL) AS "activeCount",COALESCE(SUM(c."amountMinor") FILTER (WHERE c."status"='ACTIVE' AND c."abandonedAt" IS NOT NULL),0) AS "potentialMinor",COUNT(*) FILTER (WHERE c."status"='RECOVERED') AS "recoveredCount",COALESCE(SUM(c."amountMinor") FILTER (WHERE c."status"='RECOVERED'),0) AS "recoveredMinor" FROM "AbandonedCheckout" c JOIN "Event" e ON e."id"=c."eventId" WHERE c."organizationId"=$1${scope} GROUP BY c."eventId",e."title" ORDER BY "potentialMinor" DESC`, ...params);
  const recent = await db.$queryRawUnsafe<Array<CheckoutRow & { actionStatus: string | null }>>(`SELECT c.*,e."title" AS "eventTitle",(SELECT a."status" FROM "RecoveryAction" a WHERE a."checkoutId"=c."id" ORDER BY a."createdAt" DESC LIMIT 1) AS "actionStatus" FROM "AbandonedCheckout" c JOIN "Event" e ON e."id"=c."eventId" WHERE c."organizationId"=$1${scope} AND (c."abandonedAt" IS NOT NULL OR c."status"='RECOVERED') ORDER BY COALESCE(c."recoveredAt",c."lastActivityAt") DESC LIMIT 100`, ...params);
  return { totals: totals[0] || { activeCount: BigInt(0), potentialMinor: BigInt(0), recoveredCount: BigInt(0), recoveredMinor: BigInt(0) }, events, recent };
}
