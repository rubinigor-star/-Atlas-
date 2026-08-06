import { createHmac, randomBytes } from "crypto";
import { db } from "@/lib/db";

let ready: Promise<void> | undefined;

function secret() {
  const value = process.env.SHORT_LINK_SIGNING_SECRET || process.env.CUSTOMER_AUTH_SECRET || process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET;
  if (!value) throw new Error("Missing short-link signing secret");
  return value;
}

function origin() {
  if (process.env.VERCEL_ENV === "production") {
    return (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
  }
  const previewHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (previewHost) return `https://${previewHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function ensureShortLinks() {
  ready ??= db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "TicketShortLink" (
    "code" TEXT PRIMARY KEY,
    "publicId" TEXT NOT NULL UNIQUE,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP,
    "openCount" INTEGER NOT NULL DEFAULT 0
  )`).then(() => undefined).catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

function candidateCode(publicId: string, nonce: string) {
  return createHmac("sha256", secret()).update(`${publicId}:${nonce}`).digest("base64url").slice(0, 10);
}

export async function getOrCreateShortTicketCode(publicId: string) {
  await ensureShortLinks();
  const existing = await db.$queryRawUnsafe<Array<{ code: string }>>(
    `SELECT "code" FROM "TicketShortLink" WHERE "publicId"=$1 LIMIT 1`,
    publicId,
  );
  if (existing[0]?.code) return existing[0].code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = candidateCode(publicId, randomBytes(8).toString("hex"));
    const rows = await db.$queryRawUnsafe<Array<{ code: string }>>(
      `INSERT INTO "TicketShortLink" ("code","publicId") VALUES ($1,$2)
       ON CONFLICT DO NOTHING RETURNING "code"`,
      code,
      publicId,
    );
    if (rows[0]?.code) return rows[0].code;

    const concurrent = await db.$queryRawUnsafe<Array<{ code: string }>>(
      `SELECT "code" FROM "TicketShortLink" WHERE "publicId"=$1 LIMIT 1`,
      publicId,
    );
    if (concurrent[0]?.code) return concurrent[0].code;
  }

  throw new Error("Could not create short ticket link");
}

export async function resolveShortTicketCode(code: string) {
  if (!/^[A-Za-z0-9_-]{10}$/.test(code)) return null;
  await ensureShortLinks();
  const rows = await db.$queryRawUnsafe<Array<{ publicId: string }>>(
    `UPDATE "TicketShortLink"
     SET "lastOpenedAt"=CURRENT_TIMESTAMP,"openCount"="openCount"+1
     WHERE "code"=$1
     RETURNING "publicId"`,
    code,
  );
  return rows[0]?.publicId ?? null;
}

export async function shortTicketUrl(publicId: string) {
  const code = await getOrCreateShortTicketCode(publicId);
  return `${origin()}/t/${code}`;
}
