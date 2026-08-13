import { createHash, randomUUID } from "crypto";
import { db } from "@/lib/db";
import { ORGANIZER_AGREEMENT_TEXT, ORGANIZER_AGREEMENT_TITLE, ORGANIZER_AGREEMENT_VERSION } from "@/lib/organizer-agreement";
export { ORGANIZER_AGREEMENT_TEXT, ORGANIZER_AGREEMENT_TITLE, ORGANIZER_AGREEMENT_VERSION } from "@/lib/organizer-agreement";

export type OrganizerCompliance = {
  organizationId: string;
  businessType: string | null;
  country: string | null;
  phone: string | null;
  agreementStatus: "MISSING" | "ACCEPTED";
  agreementVersion: string | null;
  agreementHash: string | null;
  agreementTitle: string | null;
  agreementText: string | null;
  acceptedAt: Date | null;
  acceptedByName: string | null;
  acceptedByEmail: string | null;
  acceptedIp: string | null;
  acceptedUserAgent: string | null;
  bankAccountStatus: "MISSING" | "PROVIDED";
  bankAccountLabel: string | null;
  bankDocumentPath: string | null;
  bankDocumentName: string | null;
  bankDocumentMime: string | null;
  bankDocumentSize: number | null;
  bankAccountUpdatedAt: Date | null;
  taxDocumentStatus: "MISSING" | "PROVIDED";
  taxDocumentLabel: string | null;
  taxDocumentPath: string | null;
  taxDocumentName: string | null;
  taxDocumentMime: string | null;
  taxDocumentSize: number | null;
  taxDocumentUpdatedAt: Date | null;
  updatedAt: Date;
};

type Row = OrganizerCompliance;

let ready: Promise<void> | null = null;
export function ensureOrganizerComplianceRuntime() {
  if (!ready) ready = (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OrganizerCompliance" (
      "organizationId" TEXT PRIMARY KEY,
      "businessType" TEXT,
      "country" TEXT,
      "phone" TEXT,
      "agreementStatus" TEXT NOT NULL DEFAULT 'MISSING',
      "agreementVersion" TEXT,
      "agreementHash" TEXT,
      "agreementTitle" TEXT,
      "agreementText" TEXT,
      "acceptedAt" TIMESTAMP,
      "acceptedByName" TEXT,
      "acceptedByEmail" TEXT,
      "acceptedIp" TEXT,
      "acceptedUserAgent" TEXT,
      "bankAccountStatus" TEXT NOT NULL DEFAULT 'MISSING',
      "bankAccountLabel" TEXT,
      "bankDocumentPath" TEXT,
      "bankDocumentName" TEXT,
      "bankDocumentMime" TEXT,
      "bankDocumentSize" INTEGER,
      "bankAccountUpdatedAt" TIMESTAMP,
      "taxDocumentStatus" TEXT NOT NULL DEFAULT 'MISSING',
      "taxDocumentLabel" TEXT,
      "taxDocumentPath" TEXT,
      "taxDocumentName" TEXT,
      "taxDocumentMime" TEXT,
      "taxDocumentSize" INTEGER,
      "taxDocumentUpdatedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "bankDocumentPath" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "bankDocumentName" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "bankDocumentMime" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "bankDocumentSize" INTEGER`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "taxDocumentPath" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "taxDocumentName" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "taxDocumentMime" TEXT`);
    await db.$executeRawUnsafe(`ALTER TABLE "OrganizerCompliance" ADD COLUMN IF NOT EXISTS "taxDocumentSize" INTEGER`);
  })().catch(error => { ready = null; throw error; });
  return ready;
}

export function organizerAgreementHash(text = ORGANIZER_AGREEMENT_TEXT) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function getOrganizerCompliance(organizationId: string): Promise<OrganizerCompliance> {
  await ensureOrganizerComplianceRuntime();
  await db.$executeRawUnsafe(`INSERT INTO "OrganizerCompliance" ("organizationId") VALUES ($1) ON CONFLICT ("organizationId") DO NOTHING`, organizationId);
  const rows = await db.$queryRawUnsafe<Row[]>(`SELECT * FROM "OrganizerCompliance" WHERE "organizationId"=$1 LIMIT 1`, organizationId);
  const row = rows[0];
  if (!row) throw new Error("COMPLIANCE_NOT_FOUND");
  return {
    ...row,
    bankDocumentSize: row.bankDocumentSize == null ? null : Number(row.bankDocumentSize),
    taxDocumentSize: row.taxDocumentSize == null ? null : Number(row.taxDocumentSize),
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt) : null,
    bankAccountUpdatedAt: row.bankAccountUpdatedAt ? new Date(row.bankAccountUpdatedAt) : null,
    taxDocumentUpdatedAt: row.taxDocumentUpdatedAt ? new Date(row.taxDocumentUpdatedAt) : null,
    updatedAt: new Date(row.updatedAt),
  };
}

export async function recordOrganizerAgreementAcceptance(input: {
  organizationId: string;
  businessType?: string | null;
  country?: string | null;
  phone?: string | null;
  signerName: string;
  signerEmail: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await ensureOrganizerComplianceRuntime();
  const hash = organizerAgreementHash();
  await db.$executeRawUnsafe(`INSERT INTO "OrganizerCompliance" (
    "organizationId","businessType","country","phone","agreementStatus","agreementVersion","agreementHash","agreementTitle","agreementText",
    "acceptedAt","acceptedByName","acceptedByEmail","acceptedIp","acceptedUserAgent","updatedAt"
  ) VALUES ($1,$2,$3,$4,'ACCEPTED',$5,$6,$7,$8,CURRENT_TIMESTAMP,$9,$10,$11,$12,CURRENT_TIMESTAMP)
  ON CONFLICT ("organizationId") DO UPDATE SET
    "businessType"=COALESCE(EXCLUDED."businessType","OrganizerCompliance"."businessType"),
    "country"=COALESCE(EXCLUDED."country","OrganizerCompliance"."country"),
    "phone"=COALESCE(EXCLUDED."phone","OrganizerCompliance"."phone"),
    "agreementStatus"='ACCEPTED',"agreementVersion"=EXCLUDED."agreementVersion","agreementHash"=EXCLUDED."agreementHash",
    "agreementTitle"=EXCLUDED."agreementTitle","agreementText"=EXCLUDED."agreementText","acceptedAt"=CURRENT_TIMESTAMP,
    "acceptedByName"=EXCLUDED."acceptedByName","acceptedByEmail"=EXCLUDED."acceptedByEmail","acceptedIp"=EXCLUDED."acceptedIp",
    "acceptedUserAgent"=EXCLUDED."acceptedUserAgent","updatedAt"=CURRENT_TIMESTAMP`,
    input.organizationId, input.businessType ?? null, input.country ?? null, input.phone ?? null,
    ORGANIZER_AGREEMENT_VERSION, hash, ORGANIZER_AGREEMENT_TITLE, ORGANIZER_AGREEMENT_TEXT,
    input.signerName, input.signerEmail.toLowerCase(), input.ip ?? null, input.userAgent ?? null,
  );
  return getOrganizerCompliance(input.organizationId);
}

export async function updateOrganizerCompliance(input: {
  organizationId: string;
  businessType?: string | null;
  country?: string | null;
  phone?: string | null;
}) {
  await ensureOrganizerComplianceRuntime();
  await getOrganizerCompliance(input.organizationId);
  await db.$executeRawUnsafe(`UPDATE "OrganizerCompliance" SET
    "businessType"=COALESCE($2,"businessType"),"country"=COALESCE($3,"country"),"phone"=COALESCE($4,"phone"),
    "updatedAt"=CURRENT_TIMESTAMP WHERE "organizationId"=$1`,
    input.organizationId, input.businessType ?? null, input.country ?? null, input.phone ?? null,
  );
  return getOrganizerCompliance(input.organizationId);
}

export async function recordOrganizerComplianceDocument(input: {
  organizationId: string;
  kind: "bank" | "tax";
  pathname: string;
  originalName: string;
  mime: string;
  size: number;
}) {
  await ensureOrganizerComplianceRuntime();
  await getOrganizerCompliance(input.organizationId);
  if (input.kind === "bank") {
    await db.$executeRawUnsafe(`UPDATE "OrganizerCompliance" SET
      "bankAccountStatus"='PROVIDED',"bankAccountLabel"=$2,"bankDocumentPath"=$3,"bankDocumentName"=$2,
      "bankDocumentMime"=$4,"bankDocumentSize"=$5,"bankAccountUpdatedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=$1`, input.organizationId, input.originalName, input.pathname, input.mime, input.size);
  } else {
    await db.$executeRawUnsafe(`UPDATE "OrganizerCompliance" SET
      "taxDocumentStatus"='PROVIDED',"taxDocumentLabel"=$2,"taxDocumentPath"=$3,"taxDocumentName"=$2,
      "taxDocumentMime"=$4,"taxDocumentSize"=$5,"taxDocumentUpdatedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
      WHERE "organizationId"=$1`, input.organizationId, input.originalName, input.pathname, input.mime, input.size);
  }
  return getOrganizerCompliance(input.organizationId);
}

export function payoutReadiness(compliance: OrganizerCompliance) {
  const checks = [
    { key: "agreement", label: "Договор Atlas", ready: compliance.agreementStatus === "ACCEPTED" },
    { key: "bank", label: "Банковские реквизиты", ready: compliance.bankAccountStatus === "PROVIDED" && Boolean(compliance.bankDocumentPath) },
    { key: "tax", label: "ניכוי מס במקור / налоговый документ", ready: compliance.taxDocumentStatus === "PROVIDED" && Boolean(compliance.taxDocumentPath) },
  ];
  return { ready: checks.every(item => item.ready), checks };
}

export function contractReference(organizationId: string, acceptedAt: Date | null) {
  const date = acceptedAt ? acceptedAt.toISOString().slice(0, 10).replaceAll("-", "") : "pending";
  return `AGR-${date}-${organizationId.slice(-8).toUpperCase()}`;
}

export function complianceDocumentId() { return `doc_${randomUUID().replaceAll("-", "")}`; }
