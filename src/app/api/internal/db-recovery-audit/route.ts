import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function iso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return value;
}

export async function GET() {
  if (process.env.VERCEL_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  try {
    const events = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        e.id,
        e.slug,
        e.title,
        e.status,
        e."posterUrl",
        e."startsAt",
        e."createdAt",
        e."updatedAt",
        COUNT(DISTINCT o.id)::int AS "orderCount",
        COUNT(DISTINCT t.id)::int AS "ticketCount"
      FROM "Event" e
      LEFT JOIN "Order" o ON o."eventId" = e.id
      LEFT JOIN "Ticket" t ON t."eventId" = e.id
      GROUP BY e.id
      ORDER BY e."createdAt" DESC, e.title ASC
    `);

    const counts = await db.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT
        (SELECT COUNT(*)::int FROM "Event") AS events,
        (SELECT COUNT(*)::int FROM "Order") AS orders,
        (SELECT COUNT(*)::int FROM "Ticket") AS tickets,
        (SELECT COUNT(*)::int FROM "User") AS users
    `);

    const suspicious = events.filter((event) => {
      const slug = String(event.slug ?? "");
      const title = String(event.title ?? "").toLowerCase();
      return slug.startsWith("test-") || slug.includes("pricing") || title.includes("neon dreams") || title.includes("magic adventure") || title.includes("jazz nights");
    });

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      environment: process.env.VERCEL_ENV ?? "unknown",
      databaseHost: (() => {
        try {
          const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
          return url ? new URL(url).hostname : null;
        } catch {
          return "configured-unparseable";
        }
      })(),
      counts: counts[0] ?? {},
      suspiciousCount: suspicious.length,
      suspicious: suspicious.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, iso(value)]))),
      events: events.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, iso(value)]))),
    });
  } catch (error) {
    console.error("db-recovery-audit failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown database audit error" }, { status: 500 });
  }
}
