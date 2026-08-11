import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const demo = await db.user.findUnique({
    where: { email: "demo.organizer@atlas-one.co" },
    select: { id: true, organizationId: true, organization: { select: { id: true, name: true } } },
  });

  const promoters = await db.promoter.findMany({
    where: { NOT: { name: { startsWith: "__" } } },
    select: { id: true, name: true, email: true, active: true, organizationId: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const links = await db.promoterLink.findMany({
    where: { promoter: { NOT: { name: { startsWith: "__" } } } },
    select: { id: true, promoterId: true, eventId: true, event: { select: { title: true, organizationId: true } } },
  });

  return NextResponse.json({
    demo,
    promoterCount: promoters.length,
    promoters,
    linkCount: links.length,
    links,
  }, { headers: { "cache-control": "no-store" } });
}
