import { db } from "@/lib/db";

let ready: Promise<void> | undefined;

function ensureRequestDismissals() {
  ready ??= db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "RequestDismissal" (
    "orderId" TEXT PRIMARY KEY,
    "dismissedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).then(() => undefined).catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

export async function dismissRequest(orderId: string) {
  await ensureRequestDismissals();
  await db.$executeRawUnsafe(
    `INSERT INTO "RequestDismissal" ("orderId","dismissedAt") VALUES ($1,CURRENT_TIMESTAMP)
     ON CONFLICT ("orderId") DO UPDATE SET "dismissedAt"=CURRENT_TIMESTAMP`,
    orderId,
  );
}

export async function getDismissedRequestIds(orderIds: string[]) {
  if (!orderIds.length) return new Set<string>();
  await ensureRequestDismissals();
  const placeholders = orderIds.map((_, index) => `$${index + 1}`).join(",");
  const rows = await db.$queryRawUnsafe<Array<{ orderId: string }>>(
    `SELECT "orderId" FROM "RequestDismissal" WHERE "orderId" IN (${placeholders})`,
    ...orderIds,
  );
  return new Set(rows.map((row) => row.orderId));
}
