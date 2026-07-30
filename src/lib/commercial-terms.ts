import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export type CommercialTerms = {
  organizationId: string;
  salesFeePercentBps: number;
  salesFeeFixedMinor: number;
  serviceFeePayer: "BUYER" | "ORGANIZER";
  refundsEnabled: boolean;
  refundFeePercentBps: number;
  refundFeeFixedMinor: number;
  refundDeadlineHours: number;
  transferRefundWindowDays: number;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function ensureCommercialTermsTables() {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrganizerCommercialTerms" (
    "organizationId" TEXT PRIMARY KEY,
    "salesFeePercentBps" INTEGER NOT NULL DEFAULT 500,
    "salesFeeFixedMinor" INTEGER NOT NULL DEFAULT 0,
    "serviceFeePayer" TEXT NOT NULL DEFAULT 'BUYER',
    "refundsEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "refundFeePercentBps" INTEGER NOT NULL DEFAULT 0,
    "refundFeeFixedMinor" INTEGER NOT NULL DEFAULT 0,
    "refundDeadlineHours" INTEGER NOT NULL DEFAULT 48,
    "transferRefundWindowDays" INTEGER NOT NULL DEFAULT 7,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CommercialTermsAudit" (
    "id" TEXT PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export async function getOrganizerTerms(organizationId: string) {
  await ensureCommercialTermsTables();
  const rows = await db.$queryRawUnsafe<CommercialTerms[]>(`SELECT * FROM "OrganizerCommercialTerms" WHERE "organizationId" = $1 LIMIT 1`, organizationId);
  if (rows[0]) return rows[0];
  await db.$executeRawUnsafe(`INSERT INTO "OrganizerCommercialTerms" ("organizationId") VALUES ($1) ON CONFLICT ("organizationId") DO NOTHING`, organizationId);
  const created = await db.$queryRawUnsafe<CommercialTerms[]>(`SELECT * FROM "OrganizerCommercialTerms" WHERE "organizationId" = $1 LIMIT 1`, organizationId);
  return created[0];
}

export async function saveOrganizerTerms(organizationId: string, actorId: string, next: Omit<CommercialTerms, "organizationId" | "updatedBy" | "createdAt" | "updatedAt">) {
  const previous = await getOrganizerTerms(organizationId);
  await db.$executeRawUnsafe(`UPDATE "OrganizerCommercialTerms" SET
    "salesFeePercentBps"=$1,
    "salesFeeFixedMinor"=$2,
    "serviceFeePayer"=$3,
    "refundsEnabled"=$4,
    "refundFeePercentBps"=$5,
    "refundFeeFixedMinor"=$6,
    "refundDeadlineHours"=$7,
    "transferRefundWindowDays"=$8,
    "updatedBy"=$9,
    "updatedAt"=CURRENT_TIMESTAMP
    WHERE "organizationId"=$10`,
    next.salesFeePercentBps,
    next.salesFeeFixedMinor,
    next.serviceFeePayer,
    next.refundsEnabled,
    next.refundFeePercentBps,
    next.refundFeeFixedMinor,
    next.refundDeadlineHours,
    next.transferRefundWindowDays,
    actorId,
    organizationId,
  );
  await db.$executeRawUnsafe(`INSERT INTO "CommercialTermsAudit" ("id","organizationId","actorId","summary","beforeJson","afterJson") VALUES ($1,$2,$3,$4,$5,$6)`,
    randomUUID(), organizationId, actorId, "Обновлены базовые условия организатора", JSON.stringify(previous), JSON.stringify(next));
  return getOrganizerTerms(organizationId);
}
