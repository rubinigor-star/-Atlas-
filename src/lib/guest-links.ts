import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

function secret() {
  const configured = process.env.GUEST_LINK_SECRET?.trim();
  if (configured) return configured;
  if (process.env.VERCEL_ENV === "production") {
    throw new Error("GUEST_LINK_SECRET is required in production");
  }
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

type GuestLinkSettingsRow = { showAttendees: boolean };
let settingsReady: Promise<void> | undefined;

export function ensureGuestLinkSettingsRuntime() {
  settingsReady ??= db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GuestLinkSettings" (
    "linkId" TEXT PRIMARY KEY,
    "showAttendees" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).then(() => undefined).catch((error) => {
    settingsReady = undefined;
    throw error;
  });
  return settingsReady;
}

export async function getGuestLinkSettings(linkId: string) {
  await ensureGuestLinkSettingsRuntime();
  const rows = await db.$queryRawUnsafe<GuestLinkSettingsRow[]>(
    `SELECT "showAttendees" FROM "GuestLinkSettings" WHERE "linkId"=$1 LIMIT 1`,
    linkId,
  );
  return { showAttendees: Boolean(rows[0]?.showAttendees) };
}

export async function setGuestLinkSettings(linkId: string, input: { showAttendees: boolean }) {
  await ensureGuestLinkSettingsRuntime();
  await db.$executeRawUnsafe(
    `INSERT INTO "GuestLinkSettings" ("linkId","showAttendees","createdAt","updatedAt")
     VALUES ($1,$2,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("linkId") DO UPDATE SET "showAttendees"=EXCLUDED."showAttendees","updatedAt"=CURRENT_TIMESTAMP`,
    linkId,
    input.showAttendees,
  );
}
