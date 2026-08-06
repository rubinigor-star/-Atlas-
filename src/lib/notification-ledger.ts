import { randomUUID } from "crypto";
import { db } from "@/lib/db";

let ready: Promise<void> | undefined;

export function ensureNotificationLedger() {
  ready ??= (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
      "id" TEXT PRIMARY KEY,
      "dedupeKey" TEXT UNIQUE,
      "organizationId" TEXT,
      "orderId" TEXT,
      "channel" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "recipient" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "providerStatus" TEXT,
      "providerMessage" TEXT,
      "priceMinor" INTEGER NOT NULL DEFAULT 0,
      "metadataJson" TEXT,
      "sentAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NotificationDelivery_org_created_idx" ON "NotificationDelivery"("organizationId","createdAt")`);
    await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "NotificationDelivery_order_idx" ON "NotificationDelivery"("orderId")`);
  })().catch((error) => { ready = undefined; throw error; });
  return ready;
}

export async function claimNotification(input: {
  dedupeKey?: string;
  organizationId?: string | null;
  orderId?: string | null;
  channel: "SMS" | "EMAIL";
  type: string;
  recipient: string;
  priceMinor?: number;
  metadata?: unknown;
}) {
  await ensureNotificationLedger();
  const id = `not_${randomUUID().replace(/-/g, "")}`;
  const rows = await db.$queryRawUnsafe<Array<{ id: string; status: string }>>(
    `INSERT INTO "NotificationDelivery" ("id","dedupeKey","organizationId","orderId","channel","type","recipient","status","priceMinor","metadataJson")
     VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING',$8,$9)
     ON CONFLICT ("dedupeKey") DO NOTHING
     RETURNING "id","status"`,
    id, input.dedupeKey ?? null, input.organizationId ?? null, input.orderId ?? null,
    input.channel, input.type, input.recipient, input.priceMinor ?? 0,
    input.metadata === undefined ? null : JSON.stringify(input.metadata),
  );
  return rows[0] ? { claimed: true, id: rows[0].id } : { claimed: false, id: null };
}

export async function completeNotification(id: string, input: { providerStatus?: unknown; providerMessage?: string | null }) {
  await ensureNotificationLedger();
  await db.$executeRawUnsafe(
    `UPDATE "NotificationDelivery" SET "status"='SENT',"providerStatus"=$2,"providerMessage"=$3,"sentAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
    id,
    input.providerStatus === undefined || input.providerStatus === null ? null : String(input.providerStatus),
    input.providerMessage ?? null,
  );
}

export async function failNotification(id: string, message: string, providerStatus?: unknown) {
  await ensureNotificationLedger();
  await db.$executeRawUnsafe(
    `UPDATE "NotificationDelivery" SET "status"='FAILED',"providerStatus"=$2,"providerMessage"=$3,"priceMinor"=0,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`,
    id,
    providerStatus === undefined || providerStatus === null ? null : String(providerStatus),
    message,
  );
}
