import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

function secret() {
  const configured = process.env.GUEST_LINK_SECRET?.trim();
  if (configured) return configured;
  if (process.env.VERCEL_ENV === "production") throw new Error("GUEST_LINK_SECRET is required in production");
  return process.env.DATABASE_URL || "atlas-local-guest-link-secret";
}

export function guestManagementToken(linkId: string) {
  return createHmac("sha256", secret()).update(`guest-link:${linkId}`).digest("hex");
}

export function verifyGuestManagementToken(linkId: string, token: string) {
  if (!token) return false;
  const expected = guestManagementToken(linkId);
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function isGuestListPromoter(name: string) {
  return name.startsWith("__GUEST_LIST__:") || name.startsWith("__CHANNEL__:GUEST:");
}

type GuestLinkSettingsRow = { showAttendees: boolean; seatIdsJson: string | null };
type ActiveSeatLockRow = { linkId: string; seatIdsJson: string | null };
let settingsReady: Promise<void> | undefined;

export function ensureGuestLinkSettingsRuntime() {
  settingsReady ??= (async () => {
    await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GuestLinkSettings" (
      "linkId" TEXT PRIMARY KEY,
      "showAttendees" BOOLEAN NOT NULL DEFAULT FALSE,
      "seatIdsJson" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.$executeRawUnsafe(`ALTER TABLE "GuestLinkSettings" ADD COLUMN IF NOT EXISTS "seatIdsJson" TEXT`);
  })().catch((error) => { settingsReady = undefined; throw error; });
  return settingsReady;
}

function parseSeatIds(value: string | null | undefined) {
  if (!value) return [] as string[];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch { return []; }
}

export async function getGuestLinkSettings(linkId: string) {
  await ensureGuestLinkSettingsRuntime();
  const rows = await db.$queryRawUnsafe<GuestLinkSettingsRow[]>(
    `SELECT "showAttendees","seatIdsJson" FROM "GuestLinkSettings" WHERE "linkId"=$1 LIMIT 1`, linkId,
  );
  return { showAttendees: Boolean(rows[0]?.showAttendees), seatIds: parseSeatIds(rows[0]?.seatIdsJson) };
}

export async function getActiveGuestSeatLocks(eventId: string) {
  await ensureGuestLinkSettingsRuntime();
  const rows = await db.$queryRawUnsafe<ActiveSeatLockRow[]>(
    `SELECT gls."linkId", gls."seatIdsJson"
     FROM "GuestLinkSettings" gls
     JOIN "PromoterLink" pl ON pl."id"=gls."linkId"
     JOIN "Promoter" p ON p."id"=pl."promoterId"
     WHERE pl."eventId"=$1
       AND pl."active"=TRUE
       AND (pl."startsAt" IS NULL OR pl."startsAt"<=CURRENT_TIMESTAMP)
       AND (pl."endsAt" IS NULL OR pl."endsAt">=CURRENT_TIMESTAMP)
       AND (p."name" LIKE '__GUEST_LIST__:%' OR p."name" LIKE '__CHANNEL__:GUEST:%')`,
    eventId,
  );
  const locks = new Map<string,string>();
  for (const row of rows) for (const seatId of parseSeatIds(row.seatIdsJson)) if (!locks.has(seatId)) locks.set(seatId,row.linkId);
  return locks;
}

export async function setGuestLinkSettings(linkId: string, input: { showAttendees: boolean; seatIds?: string[] }) {
  await ensureGuestLinkSettingsRuntime();
  const seatIdsJson = input.seatIds === undefined ? null : JSON.stringify([...new Set(input.seatIds)]);
  await db.$executeRawUnsafe(
    `INSERT INTO "GuestLinkSettings" ("linkId","showAttendees","seatIdsJson","createdAt","updatedAt")
     VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("linkId") DO UPDATE SET
       "showAttendees"=EXCLUDED."showAttendees",
       "seatIdsJson"=COALESCE(EXCLUDED."seatIdsJson","GuestLinkSettings"."seatIdsJson"),
       "updatedAt"=CURRENT_TIMESTAMP`,
    linkId, input.showAttendees, seatIdsJson,
  );
}
