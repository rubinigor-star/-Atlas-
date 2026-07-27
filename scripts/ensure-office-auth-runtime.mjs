import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

try {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "OfficeCredential" (
    "userId" TEXT PRIMARY KEY,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP NULL,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);

  const email = (process.env.OFFICE_BOOTSTRAP_EMAIL || "organizer@atlas.test").toLowerCase();
  const password = process.env.OFFICE_BOOTSTRAP_PASSWORD;
  if (password) {
    const user = await db.user.findUnique({ where: { email } });
    if (user) {
      const existing = await db.$queryRawUnsafe(`SELECT "userId" FROM "OfficeCredential" WHERE "userId"=$1 LIMIT 1`, user.id);
      if (!existing.length) {
        await db.$executeRawUnsafe(`INSERT INTO "OfficeCredential" ("userId","passwordHash","emailVerifiedAt","failedAttempts","createdAt","updatedAt") VALUES ($1,$2,CURRENT_TIMESTAMP,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`, user.id, hashPassword(password));
        console.log(`Created verified organizer credential for ${email}.`);
      }
    } else {
      console.warn(`OFFICE_BOOTSTRAP_EMAIL ${email} does not match an existing user.`);
    }
  } else {
    console.log("Office authentication table is ready. Set OFFICE_BOOTSTRAP_PASSWORD to enable the existing organizer account.");
  }
} finally {
  await db.$disconnect();
}
