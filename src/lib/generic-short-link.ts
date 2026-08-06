import { randomBytes } from "crypto";
import { db } from "@/lib/db";

let ready: Promise<void> | undefined;

function ensureGenericShortLinks() {
  ready ??= db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GenericShortLink" (
    "code" TEXT PRIMARY KEY,
    "targetPath" TEXT NOT NULL,
    "expiresAt" TIMESTAMP,
    "singleUse" BOOLEAN NOT NULL DEFAULT FALSE,
    "usedAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastOpenedAt" TIMESTAMP,
    "openCount" INTEGER NOT NULL DEFAULT 0
  )`).then(() => undefined).catch((error) => {
    ready = undefined;
    throw error;
  });
  return ready;
}

function appOrigin(requestOrigin?: string) {
  if (requestOrigin) return requestOrigin.replace(/\/$/, "");
  if (process.env.VERCEL_ENV === "production") {
    return (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.atlas-one.co").replace(/\/$/, "");
  }
  const previewHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (previewHost) return `https://${previewHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  return (process.env.PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function isSafeTargetPath(targetPath: string) {
  return targetPath.startsWith("/") && !targetPath.startsWith("//") && !targetPath.includes("\n") && !targetPath.includes("\r");
}

export async function createGenericShortLink(input: {
  targetPath: string;
  expiresAt?: Date | null;
  singleUse?: boolean;
  requestOrigin?: string;
}) {
  if (!isSafeTargetPath(input.targetPath)) throw new Error("Invalid short-link target");
  await ensureGenericShortLinks();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = randomBytes(8).toString("base64url").slice(0, 10);
    const rows = await db.$queryRawUnsafe<Array<{ code: string }>>(
      `INSERT INTO "GenericShortLink" ("code","targetPath","expiresAt","singleUse")
       VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING
       RETURNING "code"`,
      code,
      input.targetPath,
      input.expiresAt ?? null,
      Boolean(input.singleUse),
    );
    if (rows[0]?.code) return `${appOrigin(input.requestOrigin)}/s/${rows[0].code}`;
  }

  throw new Error("Could not create short link");
}

export async function resolveGenericShortLink(code: string) {
  if (!/^[A-Za-z0-9_-]{10}$/.test(code)) return null;
  await ensureGenericShortLinks();
  const rows = await db.$queryRawUnsafe<Array<{ targetPath: string; singleUse: boolean; usedAt: Date | null; expiresAt: Date | null }>>(
    `SELECT "targetPath","singleUse","usedAt","expiresAt"
     FROM "GenericShortLink"
     WHERE "code"=$1
     LIMIT 1`,
    code,
  );
  const row = rows[0];
  if (!row || !isSafeTargetPath(row.targetPath)) return null;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return null;
  if (row.singleUse && row.usedAt) return null;

  await db.$executeRawUnsafe(
    `UPDATE "GenericShortLink"
     SET "lastOpenedAt"=CURRENT_TIMESTAMP,
         "openCount"="openCount"+1,
         "usedAt"=CASE WHEN "singleUse"=TRUE THEN CURRENT_TIMESTAMP ELSE "usedAt" END
     WHERE "code"=$1`,
    code,
  );
  return row.targetPath;
}
