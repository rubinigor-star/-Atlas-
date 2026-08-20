import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { reviewOrder, type OrderReviewInput } from "@/lib/order-review-service";
import { sendOrderTicketSms } from "@/lib/order-sms";
import { enrollApprovedOrderInValueCard } from "@/lib/valuecard";

type Actor = Pick<User, "id" | "organizationId">;

type JobRow = {
  id: string;
  orderId: string;
  publicId: string;
  action: "approve" | "reject";
  note: string | null;
  actorId: string;
  organizationId: string | null;
  status: string;
  attempts: number;
};

let runtimeReady: Promise<void> | undefined;

export function ensureOrderReviewQueueRuntime() {
  runtimeReady ??= (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrderReviewJob" (
      "id" TEXT PRIMARY KEY,
      "orderId" TEXT NOT NULL UNIQUE,
      "publicId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "note" TEXT,
      "actorId" TEXT NOT NULL,
      "organizationId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'QUEUED',
      "attempts" INTEGER NOT NULL DEFAULT 0,
      "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lockedAt" TIMESTAMP(3),
      "completedAt" TIMESTAMP(3),
      "lastError" TEXT,
      "resultJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderReviewJob_status_availableAt_idx" ON "OrderReviewJob"("status", "availableAt")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "OrderReviewJob_lockedAt_idx" ON "OrderReviewJob"("lockedAt")`);
  })().catch((error) => {
    runtimeReady = undefined;
    throw error;
  });
  return runtimeReady;
}

export async function enqueueOrderReview(publicId: string, input: OrderReviewInput, actor: Actor) {
  await ensureOrderReviewQueueRuntime();
  const order = await db.order.findUnique({ where: { publicId }, select: { id: true, status: true } });
  if (!order) throw new Error("Заявка не найдена");
  if (order.status !== "PENDING_APPROVAL" && !(input.action === "approve" && order.status === "PAID")) {
    throw new Error("Эта заявка уже рассмотрена");
  }

  const id = randomUUID();
  const inserted = await db.$queryRawUnsafe<JobRow[]>(
    `INSERT INTO "OrderReviewJob" ("id","orderId","publicId","action","note","actorId","organizationId","status","attempts","availableAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,'QUEUED',0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("orderId") DO UPDATE SET
       "action"=EXCLUDED."action",
       "note"=EXCLUDED."note",
       "actorId"=EXCLUDED."actorId",
       "organizationId"=EXCLUDED."organizationId",
       "status"='QUEUED',
       "attempts"=0,
       "availableAt"=CURRENT_TIMESTAMP,
       "lockedAt"=NULL,
       "completedAt"=NULL,
       "lastError"=NULL,
       "resultJson"=NULL,
       "updatedAt"=CURRENT_TIMESTAMP
     WHERE "OrderReviewJob"."status"='FAILED'
     RETURNING "id","orderId","publicId","action","note","actorId","organizationId","status","attempts"`,
    id,
    order.id,
    publicId,
    input.action,
    input.note?.trim() || null,
    actor.id,
    actor.organizationId ?? null,
  );

  if (inserted[0]) return inserted[0];
  const existing = await db.$queryRawUnsafe<JobRow[]>(
    `SELECT "id","orderId","publicId","action","note","actorId","organizationId","status","attempts" FROM "OrderReviewJob" WHERE "orderId"=$1 LIMIT 1`,
    order.id,
  );
  const job = existing[0];
  if (!job) throw new Error("Не удалось поставить заявку в очередь");
  if (job.action !== input.action && job.status !== "FAILED") throw new Error("По этой заявке уже выполняется другое решение");
  return job;
}

async function claimNextJob(): Promise<JobRow | null> {
  await ensureOrderReviewQueueRuntime();
  const rows = await db.$queryRawUnsafe<JobRow[]>(`
    WITH candidate AS (
      SELECT "id" FROM "OrderReviewJob"
      WHERE (
        ("status"='QUEUED' AND "availableAt" <= CURRENT_TIMESTAMP)
        OR ("status"='PROCESSING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
      )
      AND "attempts" < 5
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "OrderReviewJob" j
    SET "status"='PROCESSING', "lockedAt"=CURRENT_TIMESTAMP, "attempts"=j."attempts"+1, "updatedAt"=CURRENT_TIMESTAMP
    FROM candidate c
    WHERE j."id"=c."id"
    RETURNING j."id",j."orderId",j."publicId",j."action",j."note",j."actorId",j."organizationId",j."status",j."attempts"
  `);
  return rows[0] ?? null;
}

async function completeJob(job: JobRow, result: unknown) {
  await db.$executeRawUnsafe(
    `UPDATE "OrderReviewJob" SET "status"='COMPLETED',"completedAt"=CURRENT_TIMESTAMP,"lockedAt"=NULL,"lastError"=NULL,"resultJson"=$2,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
    job.id,
    JSON.stringify(result),
  );
}

async function failJob(job: JobRow, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown order review error";
  const terminal = job.attempts >= 5 || /FORBIDDEN/i.test(message);
  const delaySeconds = Math.min(60, Math.max(2, 2 ** Math.max(0, job.attempts - 1)));
  await db.$executeRawUnsafe(
    `UPDATE "OrderReviewJob"
     SET "status"=$2,"lockedAt"=NULL,"lastError"=$3,
         "availableAt"=CASE WHEN $2='QUEUED' THEN CURRENT_TIMESTAMP + ($4 * INTERVAL '1 second') ELSE "availableAt" END,
         "updatedAt"=CURRENT_TIMESTAMP
     WHERE "id"=$1`,
    job.id,
    terminal ? "FAILED" : "QUEUED",
    message.slice(0, 2000),
    delaySeconds,
  );
  console.error("order_review_queue.job_failed", { jobId: job.id, publicId: job.publicId, action: job.action, attempts: job.attempts, terminal, message });
}

async function alreadyReachedFinalState(job: JobRow) {
  const order = await db.order.findUnique({ where: { id: job.orderId }, select: { status: true } });
  return (job.action === "approve" && order?.status === "PAID") || (job.action === "reject" && order?.status === "REJECTED");
}

export async function processOrderReviewJobs(limit = 10) {
  let processed = 0;
  let completed = 0;
  let failed = 0;
  for (let index = 0; index < limit; index++) {
    const job = await claimNextJob();
    if (!job) break;
    processed++;
    try {
      const result = await reviewOrder(
        job.publicId,
        { action: job.action, note: job.note ?? undefined },
        { id: job.actorId, organizationId: job.organizationId },
      );
      let valueCard: Awaited<ReturnType<typeof enrollApprovedOrderInValueCard>> | { created: false; member: null; error: string } | undefined;
      let smsSent: boolean | undefined;
      let smsError: string | undefined;
      if (job.action === "approve" && result.status === "PAID") {
        try {
          valueCard = await enrollApprovedOrderInValueCard(job.publicId);
        } catch (error) {
          const message = error instanceof Error ? error.message : "ValueCard enrollment error";
          valueCard = { created: false, member: null, error: message };
          console.error("order_review_queue.valuecard_enrollment_failed", { publicId: job.publicId, message });
        }
        try {
          await sendOrderTicketSms(job.publicId, { automatic: true });
          smsSent = true;
        } catch (error) {
          smsSent = false;
          smsError = error instanceof Error ? error.message : "Ошибка SMS";
          console.error("order_review_queue.ticket_sms_failed", { publicId: job.publicId, message: smsError });
        }
      }
      await completeJob(job, { ...result, valueCard, smsSent, smsError });
      completed++;
    } catch (error) {
      if (await alreadyReachedFinalState(job)) {
        await completeJob(job, { status: job.action === "approve" ? "PAID" : "REJECTED", recoveredAfterWorkerRestart: true });
        completed++;
        continue;
      }
      await failJob(job, error);
      failed++;
    }
  }
  return { processed, completed, failed };
}

export async function getActiveOrderReviewJobIds(orderIds: string[]) {
  if (!orderIds.length) return new Set<string>();
  await ensureOrderReviewQueueRuntime();
  const placeholders = orderIds.map((_, index) => `$${index + 1}`).join(",");
  const rows = await db.$queryRawUnsafe<Array<{ orderId: string }>>(
    `SELECT "orderId" FROM "OrderReviewJob" WHERE "orderId" IN (${placeholders}) AND "status" IN ('QUEUED','PROCESSING')`,
    ...orderIds,
  );
  return new Set(rows.map((row) => row.orderId));
}

export async function getActiveOrderReviewJobIdsForEvent(eventId: string) {
  await ensureOrderReviewQueueRuntime();
  const rows = await db.$queryRawUnsafe<Array<{ orderId: string }>>(
    `SELECT j."orderId" FROM "OrderReviewJob" j JOIN "Order" o ON o."id"=j."orderId" WHERE o."eventId"=$1 AND j."status" IN ('QUEUED','PROCESSING')`,
    eventId,
  );
  return new Set(rows.map((row) => row.orderId));
}
