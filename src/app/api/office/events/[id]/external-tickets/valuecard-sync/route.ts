import { NextResponse } from "next/server";
import { z } from "zod";
import { requireEventAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureExternalTicketStorage } from "@/lib/external-ticket-storage";
import { getValueCardToken, registerValueCardMember, searchValueCardMember } from "@/lib/valuecard";

const schema = z.object({
  sourceId: z.string().min(1).max(200),
  afterId: z.string().min(1).max(200).nullable().optional(),
});

const BATCH_SIZE = 5;

type ExternalCustomerRow = {
  id: string;
  holderName: string | null;
  phone: string;
  email: string | null;
  metadataJson: string | null;
};

type SourceRow = { id: string };

type Metadata = {
  __atlasOrganizerConsent?: boolean;
  __atlasFirstName?: string | null;
  __atlasLastName?: string | null;
};

function parseMetadata(value: string | null): Metadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Metadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function splitName(holderName: string | null, metadata: Metadata) {
  const explicitFirst = typeof metadata.__atlasFirstName === "string" ? metadata.__atlasFirstName.trim() : "";
  const explicitLast = typeof metadata.__atlasLastName === "string" ? metadata.__atlasLastName.trim() : "";
  if (explicitFirst && explicitLast) return { firstName: explicitFirst, lastName: explicitLast };
  const parts = (holderName || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: explicitFirst || parts[0] || "",
    lastName: explicitLast || parts.slice(1).join(" ") || "",
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: eventId } = await params;
    await requireEventAccess("TICKET_MANAGE", eventId);
    await ensureExternalTicketStorage();
    const input = schema.parse(await request.json());

    const event = await db.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
    if (!event) throw new Error("EVENT_NOT_FOUND");
    const token = await getValueCardToken(event.organizationId);
    if (!token) throw new Error("VALUECARD_NOT_CONFIGURED");

    const source = await db.$queryRawUnsafe<SourceRow[]>(
      `SELECT "id" FROM "ExternalTicketSource" WHERE "id"=$1 AND "eventId"=$2 LIMIT 1`,
      input.sourceId,
      eventId,
    );
    if (!source[0]) throw new Error("SOURCE_NOT_FOUND");

    const rows = await db.$queryRawUnsafe<ExternalCustomerRow[]>(
      `SELECT DISTINCT ON (c."id")
         c."id", c."name" AS "holderName", c."phone", c."email", t."metadataJson"
       FROM "ExternalCustomer" c
       JOIN "ExternalTicket" t ON t."customerId"=c."id"
       WHERE t."sourceId"=$1 AND t."eventId"=$2
         AND t."metadataJson" LIKE '%"__atlasOrganizerConsent":true%'
         AND ($3::text IS NULL OR c."id" > $3)
       ORDER BY c."id" ASC, t."id" ASC
       LIMIT $4`,
      input.sourceId,
      eventId,
      input.afterId || null,
      BATCH_SIZE + 1,
    );

    const batch = rows.slice(0, BATCH_SIZE);
    const errors: Array<{ ticketId: string; reason: string }> = [];
    let skipped = 0;

    const candidates = batch.flatMap((row) => {
      const metadata = parseMetadata(row.metadataJson);
      if (metadata.__atlasOrganizerConsent !== true) {
        skipped += 1;
        errors.push({ ticketId: row.id, reason: "NO_EXPLICIT_CONSENT" });
        return [];
      }
      const names = splitName(row.holderName, metadata);
      if (!names.firstName || !names.lastName) {
        skipped += 1;
        errors.push({ ticketId: row.id, reason: "MISSING_NAME" });
        return [];
      }
      return [{ row, ...names }];
    });

    const outcomes = await Promise.all(candidates.map(async ({ row, firstName, lastName }) => {
      try {
        const existing = await searchValueCardMember(event.organizationId, row.phone);
        if (existing) return { kind: "existing" as const, ticketId: row.id };
        await registerValueCardMember({
          organizationId: event.organizationId,
          firstName,
          lastName,
          cellPhone: row.phone,
          email: row.email,
        });
        return { kind: "created" as const, ticketId: row.id };
      } catch (error) {
        return {
          kind: "failed" as const,
          ticketId: row.id,
          reason: error instanceof Error ? error.message : "VALUECARD_SYNC_FAILED",
        };
      }
    }));

    let created = 0;
    let existing = 0;
    let failed = 0;
    for (const outcome of outcomes) {
      if (outcome.kind === "created") created += 1;
      else if (outcome.kind === "existing") existing += 1;
      else {
        failed += 1;
        errors.push({ ticketId: outcome.ticketId, reason: outcome.reason });
      }
    }

    if (!input.afterId) {
      await db.$executeRawUnsafe(
        `UPDATE "ExternalTicketSource"
         SET "valueCardCreatedTotal"=COALESCE("valueCardCreatedTotal",0)+$2,
             "valueCardLastCreated"=$2,
             "valueCardLastExisting"=$3,
             "valueCardLastSkipped"=$4,
             "valueCardLastFailed"=$5,
             "valueCardLastSyncedAt"=CURRENT_TIMESTAMP,
             "updatedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$1`,
        input.sourceId, created, existing, skipped, failed,
      );
    } else {
      await db.$executeRawUnsafe(
        `UPDATE "ExternalTicketSource"
         SET "valueCardCreatedTotal"=COALESCE("valueCardCreatedTotal",0)+$2,
             "valueCardLastCreated"=COALESCE("valueCardLastCreated",0)+$2,
             "valueCardLastExisting"=COALESCE("valueCardLastExisting",0)+$3,
             "valueCardLastSkipped"=COALESCE("valueCardLastSkipped",0)+$4,
             "valueCardLastFailed"=COALESCE("valueCardLastFailed",0)+$5,
             "valueCardLastSyncedAt"=CURRENT_TIMESTAMP,
             "updatedAt"=CURRENT_TIMESTAMP
         WHERE "id"=$1`,
        input.sourceId, created, existing, skipped, failed,
      );
    }

    const nextCursor = rows.length > BATCH_SIZE ? batch[batch.length - 1]?.id || null : null;
    return NextResponse.json({
      ok: true,
      processed: batch.length,
      created,
      existing,
      skipped,
      failed,
      errors: errors.slice(0, 20),
      nextCursor,
    });
  } catch (error) {
    console.error("[external-ticket-valuecard-sync] failed", error);
    const message = error instanceof Error ? error.message : "VALUECARD_SYNC_FAILED";
    const status = message === "FORBIDDEN" ? 403 : message === "VALUECARD_NOT_CONFIGURED" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
