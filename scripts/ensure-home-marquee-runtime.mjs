import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

try {
  await db.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HomeMarqueeEvent" (
    "eventId" TEXT PRIMARY KEY,
    "position" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE
  )`);
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HomeMarqueeEvent_position_idx" ON "HomeMarqueeEvent"("position")`);
  console.log("Home marquee runtime table is ready.");
} finally {
  await db.$disconnect();
}
