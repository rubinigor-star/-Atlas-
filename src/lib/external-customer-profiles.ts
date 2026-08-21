import { randomUUID } from "crypto";
import { db } from "@/lib/db";

export type ImportedGender = "MALE" | "FEMALE" | "UNSPECIFIED";

type TicketRow = {
  id: string;
  phone: string | null;
  holderName: string | null;
  email: string | null;
  metadataJson: string | null;
};

type CustomerRow = { id: string; normalizedPhone: string };

type Metadata = Record<string, unknown> & {
  __atlasFirstName?: string | null;
  __atlasLastName?: string | null;
  __atlasBirthDate?: string | null;
  __atlasCity?: string | null;
  __atlasGender?: ImportedGender | null;
};

export function normalizeCustomerPhone(value: string | null | undefined) {
  let digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00972")) digits = digits.slice(2);
  if (digits.startsWith("972") && digits.length >= 11) digits = `0${digits.slice(3)}`;
  if (!digits.startsWith("0") && digits.length === 9) digits = `0${digits}`;
  return digits;
}

function metadata(value: string | null): Metadata {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Metadata;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function splitName(holderName: string | null, meta: Metadata) {
  const first = clean(meta.__atlasFirstName);
  const last = clean(meta.__atlasLastName);
  if (first || last) return { firstName: first, lastName: last };
  const parts = (holderName || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: null, lastName: null };
  return { firstName: parts[0] || null, lastName: parts.slice(1).join(" ") || null };
}

function parseDate(value: unknown) {
  const raw = clean(value);
  if (!raw) return null;
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : iso;
}

export async function ensureExternalCustomerProfileColumns() {
  await db.$executeRawUnsafe(`ALTER TABLE "ExternalCustomer" ADD COLUMN IF NOT EXISTS "firstName" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "ExternalCustomer" ADD COLUMN IF NOT EXISTS "lastName" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "ExternalCustomer" ADD COLUMN IF NOT EXISTS "birthDate" DATE`);
  await db.$executeRawUnsafe(`ALTER TABLE "ExternalCustomer" ADD COLUMN IF NOT EXISTS "city" TEXT`);
  await db.$executeRawUnsafe(`ALTER TABLE "ExternalCustomer" ADD COLUMN IF NOT EXISTS "gender" TEXT`);
}

export async function syncExternalCustomerProfiles(eventId: string, sourceId?: string) {
  await ensureExternalCustomerProfileColumns();
  const event = await db.event.findUnique({ where: { id: eventId }, select: { organizationId: true } });
  if (!event) throw new Error("EVENT_NOT_FOUND");

  const rows = await db.$queryRawUnsafe<TicketRow[]>(
    `SELECT "id","phone","holderName","email","metadataJson" FROM "ExternalTicket"
     WHERE "eventId"=$1 AND ($2::text IS NULL OR "sourceId"=$2) AND "phone" IS NOT NULL`,
    eventId,
    sourceId || null,
  );

  const byPhone = new Map<string, { phone: string; holderName: string | null; email: string | null; meta: Metadata; ticketIds: string[] }>();
  for (const row of rows) {
    const key = normalizeCustomerPhone(row.phone);
    if (!key) continue;
    const existing = byPhone.get(key);
    const meta = metadata(row.metadataJson);
    if (!existing) {
      byPhone.set(key, { phone: row.phone!, holderName: row.holderName, email: row.email, meta, ticketIds: [row.id] });
    } else {
      existing.ticketIds.push(row.id);
      if (!existing.holderName && row.holderName) existing.holderName = row.holderName;
      if (!existing.email && row.email) existing.email = row.email;
      for (const [k, v] of Object.entries(meta)) if (existing.meta[k] == null && v != null) existing.meta[k] = v;
    }
  }

  let created = 0;
  let updated = 0;
  for (const [normalizedPhone, entry] of byPhone) {
    const names = splitName(entry.holderName, entry.meta);
    const birthDate = parseDate(entry.meta.__atlasBirthDate);
    const city = clean(entry.meta.__atlasCity);
    const gender = entry.meta.__atlasGender === "MALE" || entry.meta.__atlasGender === "FEMALE" ? entry.meta.__atlasGender : "UNSPECIFIED";
    const customerId = randomUUID();
    const existing = await db.$queryRawUnsafe<CustomerRow[]>(
      `SELECT "id","normalizedPhone" FROM "ExternalCustomer" WHERE "organizationId"=$1 AND "normalizedPhone"=$2 LIMIT 1`,
      event.organizationId,
      normalizedPhone,
    );
    const id = existing[0]?.id || customerId;
    await db.$executeRawUnsafe(
      `INSERT INTO "ExternalCustomer" ("id","organizationId","normalizedPhone","phone","name","firstName","lastName","email","birthDate","city","gender","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
       ON CONFLICT ("organizationId","normalizedPhone") DO UPDATE SET
         "phone"=EXCLUDED."phone",
         "name"=COALESCE(EXCLUDED."name","ExternalCustomer"."name"),
         "firstName"=COALESCE(EXCLUDED."firstName","ExternalCustomer"."firstName"),
         "lastName"=COALESCE(EXCLUDED."lastName","ExternalCustomer"."lastName"),
         "email"=COALESCE(EXCLUDED."email","ExternalCustomer"."email"),
         "birthDate"=COALESCE(EXCLUDED."birthDate","ExternalCustomer"."birthDate"),
         "city"=COALESCE(EXCLUDED."city","ExternalCustomer"."city"),
         "gender"=CASE WHEN EXCLUDED."gender"='UNSPECIFIED' THEN COALESCE("ExternalCustomer"."gender",EXCLUDED."gender") ELSE EXCLUDED."gender" END,
         "updatedAt"=CURRENT_TIMESTAMP`,
      id,
      event.organizationId,
      normalizedPhone,
      entry.phone,
      clean(entry.holderName),
      names.firstName,
      names.lastName,
      clean(entry.email),
      birthDate,
      city,
      gender,
    );
    await db.$executeRawUnsafe(
      `UPDATE "ExternalTicket" SET "customerId"=$1,"updatedAt"=CURRENT_TIMESTAMP WHERE "eventId"=$2 AND "phone" IS NOT NULL AND regexp_replace("phone",'\\D','','g') IN ($3,$4,$5)`,
      id,
      eventId,
      normalizedPhone,
      normalizedPhone.replace(/^0/, "972"),
      normalizedPhone.replace(/^0/, ""),
    );
    if (existing[0]) updated += 1; else created += 1;
  }

  return { customers: byPhone.size, created, updated };
}
