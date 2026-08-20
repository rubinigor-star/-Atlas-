import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type Executor = typeof db | Prisma.TransactionClient;

export type ExternalTicketStatus = "VALID" | "USED" | "CANCELLED";

export type ExternalTicketImportRow = {
  externalTicketId?: string | null;
  externalOrderId?: string | null;
  scanCode: string;
  holderName?: string | null;
  phone?: string | null;
  email?: string | null;
  ticketType?: string | null;
  priceMinor?: number | null;
  currency?: string | null;
  status?: ExternalTicketStatus | null;
  metadata?: Record<string, unknown> | null;
};

type SourceRow = { id: string; eventId: string; name: string; sourceKey: string; platformKey: string | null };
type ExistingTicketRow = { externalTicketId: string };
type LookupRow = {
  id: string;
  eventId: string;
  sourceId: string;
  sourceName: string;
  platformKey: string | null;
  externalTicketId: string;
  externalOrderId: string | null;
  holderName: string | null;
  ticketType: string | null;
  status: ExternalTicketStatus;
  scannedAt: Date | string | null;
};

export type ExternalCheckinResult = {
  status: "VALID" | "USED" | "CANCELLED" | "NOT_FOUND" | "AMBIGUOUS";
  message: string;
  externalTicketId?: string;
  eventId?: string;
  holderName?: string;
  categoryName?: string;
  sourceName?: string;
  platformKey?: string | null;
};

function clean(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}

export function normalizeExternalTicketCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const queryCode = url.searchParams.get("code") || url.searchParams.get("ticket");
    if (queryCode) return queryCode.trim();
    const last = url.pathname.split("/").filter(Boolean).at(-1);
    return (last || trimmed).trim();
  } catch {
    return trimmed;
  }
}

export function externalSourceKey(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё_-]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "external";
}

function normalizeStatus(value?: ExternalTicketStatus | null): ExternalTicketStatus {
  return value === "USED" || value === "CANCELLED" ? value : "VALID";
}

function safeCurrency(value?: string | null) {
  const currency = value?.trim().toUpperCase();
  return currency && /^[A-Z]{3}$/.test(currency) ? currency : "ILS";
}

export async function importExternalTickets({
  eventId,
  sourceName,
  sourceKey,
  platformKey,
  fileName,
  mapping,
  createdById,
  rows,
}: {
  eventId: string;
  sourceName: string;
  sourceKey?: string | null;
  platformKey?: string | null;
  fileName?: string | null;
  mapping?: Record<string, string> | null;
  createdById?: string | null;
  rows: ExternalTicketImportRow[];
}) {
  const normalizedSourceKey = externalSourceKey(sourceKey || sourceName);
  const prepared = new Map<string, Required<Pick<ExternalTicketImportRow, "scanCode">> & ExternalTicketImportRow & { normalizedScanCode: string; stableTicketId: string; status: ExternalTicketStatus }>();
  const rowErrors: Array<{ row: number; error: string }> = [];

  rows.forEach((row, index) => {
    const normalizedScanCode = normalizeExternalTicketCode(row.scanCode || "");
    if (!normalizedScanCode) {
      rowErrors.push({ row: index + 1, error: "EMPTY_SCAN_CODE" });
      return;
    }
    const stableTicketId = clean(row.externalTicketId) || normalizedScanCode;
    if (prepared.has(stableTicketId)) {
      rowErrors.push({ row: index + 1, error: "DUPLICATE_EXTERNAL_TICKET_ID_IN_FILE" });
      return;
    }
    prepared.set(stableTicketId, {
      ...row,
      scanCode: row.scanCode.trim(),
      normalizedScanCode,
      stableTicketId,
      status: normalizeStatus(row.status),
    });
  });

  const uniqueRows = [...prepared.values()];
  if (!uniqueRows.length) throw new Error("В файле нет билетов с QR/Barcode");

  return db.$transaction(async (tx) => {
    const sourceId = randomUUID();
    await tx.$executeRawUnsafe(
      `INSERT INTO "ExternalTicketSource" ("id","eventId","name","sourceKey","platformKey","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("eventId","sourceKey") DO UPDATE SET
         "name"=EXCLUDED."name",
         "platformKey"=COALESCE(EXCLUDED."platformKey","ExternalTicketSource"."platformKey"),
         "updatedAt"=CURRENT_TIMESTAMP`,
      sourceId,
      eventId,
      sourceName.trim(),
      normalizedSourceKey,
      clean(platformKey),
    );

    const sources = await tx.$queryRawUnsafe<SourceRow[]>(
      `SELECT "id","eventId","name","sourceKey","platformKey" FROM "ExternalTicketSource" WHERE "eventId"=$1 AND "sourceKey"=$2 LIMIT 1`,
      eventId,
      normalizedSourceKey,
    );
    const source = sources[0];
    if (!source) throw new Error("Не удалось создать источник внешних билетов");

    const existing = await tx.$queryRawUnsafe<ExistingTicketRow[]>(
      `SELECT "externalTicketId" FROM "ExternalTicket" WHERE "sourceId"=$1`,
      source.id,
    );
    const existingIds = new Set(existing.map((ticket) => ticket.externalTicketId));

    const batchId = randomUUID();
    await tx.$executeRawUnsafe(
      `INSERT INTO "ExternalTicketImportBatch" ("id","sourceId","fileName","rowCount","insertedCount","updatedCount","errorCount","mappingJson","createdById","importedAt")
       VALUES ($1,$2,$3,$4,0,0,$5,$6,$7,CURRENT_TIMESTAMP)`,
      batchId,
      source.id,
      clean(fileName),
      rows.length,
      rowErrors.length,
      mapping ? JSON.stringify(mapping) : null,
      clean(createdById),
    );

    let insertedCount = 0;
    let updatedCount = 0;

    for (const row of uniqueRows) {
      const isExisting = existingIds.has(row.stableTicketId);
      try {
        await tx.$executeRawUnsafe(
          `INSERT INTO "ExternalTicket" (
             "id","eventId","sourceId","importBatchId","externalTicketId","externalOrderId","rawScanCode","normalizedScanCode",
             "holderName","phone","email","ticketType","priceMinor","currency","status","metadataJson","createdAt","updatedAt"
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
           ON CONFLICT ("sourceId","externalTicketId") DO UPDATE SET
             "importBatchId"=EXCLUDED."importBatchId",
             "externalOrderId"=EXCLUDED."externalOrderId",
             "rawScanCode"=EXCLUDED."rawScanCode",
             "normalizedScanCode"=EXCLUDED."normalizedScanCode",
             "holderName"=COALESCE(EXCLUDED."holderName","ExternalTicket"."holderName"),
             "phone"=COALESCE(EXCLUDED."phone","ExternalTicket"."phone"),
             "email"=COALESCE(EXCLUDED."email","ExternalTicket"."email"),
             "ticketType"=COALESCE(EXCLUDED."ticketType","ExternalTicket"."ticketType"),
             "priceMinor"=COALESCE(EXCLUDED."priceMinor","ExternalTicket"."priceMinor"),
             "currency"=EXCLUDED."currency",
             "status"=CASE WHEN "ExternalTicket"."status"='USED' THEN 'USED' ELSE EXCLUDED."status" END,
             "metadataJson"=COALESCE(EXCLUDED."metadataJson","ExternalTicket"."metadataJson"),
             "updatedAt"=CURRENT_TIMESTAMP`,
          randomUUID(),
          eventId,
          source.id,
          batchId,
          row.stableTicketId,
          clean(row.externalOrderId),
          row.scanCode,
          row.normalizedScanCode,
          clean(row.holderName),
          clean(row.phone),
          clean(row.email),
          clean(row.ticketType),
          typeof row.priceMinor === "number" && Number.isFinite(row.priceMinor) ? Math.round(row.priceMinor) : null,
          safeCurrency(row.currency),
          row.status,
          row.metadata ? JSON.stringify(row.metadata) : null,
        );
        if (isExisting) updatedCount += 1;
        else insertedCount += 1;
      } catch (error) {
        rowErrors.push({
          row: rows.findIndex((candidate) => (clean(candidate.externalTicketId) || normalizeExternalTicketCode(candidate.scanCode || "")) === row.stableTicketId) + 1,
          error: error instanceof Error ? error.message : "IMPORT_FAILED",
        });
      }
    }

    await tx.$executeRawUnsafe(
      `UPDATE "ExternalTicketImportBatch" SET "insertedCount"=$1,"updatedCount"=$2,"errorCount"=$3 WHERE "id"=$4`,
      insertedCount,
      updatedCount,
      rowErrors.length,
      batchId,
    );

    return {
      source,
      batchId,
      rowCount: rows.length,
      processedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
      errorCount: rowErrors.length,
      errors: rowErrors.slice(0, 50),
    };
  }, { timeout: 30_000 });
}

export async function findExternalTicketsForScan(eventId: string, code: string, executor: Executor = db) {
  const normalizedCode = normalizeExternalTicketCode(code);
  if (!normalizedCode) return [] as LookupRow[];
  return executor.$queryRawUnsafe<LookupRow[]>(
    `SELECT t."id",t."eventId",t."sourceId",s."name" AS "sourceName",s."platformKey",t."externalTicketId",t."externalOrderId",t."holderName",t."ticketType",t."status",t."scannedAt"
     FROM "ExternalTicket" t
     JOIN "ExternalTicketSource" s ON s."id"=t."sourceId"
     WHERE t."eventId"=$1 AND t."normalizedScanCode"=$2
     LIMIT 2`,
    eventId,
    normalizedCode,
  );
}

export async function checkInExternalTicket(eventId: string, code: string): Promise<ExternalCheckinResult> {
  const normalizedCode = normalizeExternalTicketCode(code);
  if (!normalizedCode) return { status: "NOT_FOUND", message: "Код билета пуст" };

  return db.$transaction(async (tx) => {
    const matches = await findExternalTicketsForScan(eventId, normalizedCode, tx);
    if (!matches.length) return { status: "NOT_FOUND", message: "Внешний билет с таким кодом не найден" };
    if (matches.length > 1) {
      return { status: "AMBIGUOUS", message: "Одинаковый QR найден в нескольких внешних источниках. Требуется ручная проверка." };
    }

    const ticket = matches[0];
    const details = {
      externalTicketId: ticket.id,
      eventId: ticket.eventId,
      holderName: ticket.holderName || undefined,
      categoryName: ticket.ticketType || undefined,
      sourceName: ticket.sourceName,
      platformKey: ticket.platformKey,
    };

    if (ticket.status === "CANCELLED") {
      await tx.$executeRawUnsafe(
        `INSERT INTO "ExternalTicketScan" ("id","externalTicketId","result","scannedAt") VALUES ($1,$2,'CANCELLED',CURRENT_TIMESTAMP)`,
        randomUUID(),
        ticket.id,
      );
      return { status: "CANCELLED", message: "Внешний билет отменён", ...details };
    }

    if (ticket.status === "USED") {
      await tx.$executeRawUnsafe(
        `INSERT INTO "ExternalTicketScan" ("id","externalTicketId","result","scannedAt") VALUES ($1,$2,'USED',CURRENT_TIMESTAMP)`,
        randomUUID(),
        ticket.id,
      );
      return { status: "USED", message: "Этот внешний билет уже был использован", ...details };
    }

    const claimed = await tx.$executeRawUnsafe(
      `UPDATE "ExternalTicket" SET "status"='USED',"scannedAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 AND "status"='VALID'`,
      ticket.id,
    );
    if (claimed !== 1) {
      await tx.$executeRawUnsafe(
        `INSERT INTO "ExternalTicketScan" ("id","externalTicketId","result","scannedAt") VALUES ($1,$2,'USED',CURRENT_TIMESTAMP)`,
        randomUUID(),
        ticket.id,
      );
      return { status: "USED", message: "Внешний билет уже использован другим устройством", ...details };
    }

    await tx.$executeRawUnsafe(
      `INSERT INTO "ExternalTicketScan" ("id","externalTicketId","result","scannedAt") VALUES ($1,$2,'VALID',CURRENT_TIMESTAMP)`,
      randomUUID(),
      ticket.id,
    );
    return { status: "VALID", message: "Вход разрешён", ...details };
  });
}
