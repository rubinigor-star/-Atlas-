import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const [demo, organizations, promoters, links, audits] = await Promise.all([
    db.user.findUnique({
      where: { email: "demo.organizer@atlas-one.co" },
      select: { id: true, name: true, organizationId: true, createdAt: true, organization: { select: { id: true, name: true, createdAt: true } } },
    }),
    db.organization.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        _count: { select: { users: true, events: true, promoters: true } },
        users: { where: { email: "demo.organizer@atlas-one.co" }, select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.promoter.findMany({
      select: { id: true, name: true, email: true, active: true, organizationId: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: "asc" },
    }),
    db.promoterLink.findMany({
      select: { id: true, code: true, promoterId: true, eventId: true, createdAt: true, promoter: { select: { name: true, organizationId: true } }, event: { select: { title: true, organizationId: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.auditLog.findMany({
      where: { OR: [
        { entityType: { contains: "Promoter" } },
        { action: { contains: "PROMOTER" } },
      ] },
      select: { id: true, action: true, entityType: true, entityId: true, summary: true, organizationId: true, createdAt: true, actorId: true, metadata: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    }),
  ]);

  return NextResponse.json({
    demo,
    organizations,
    promoterCount: promoters.length,
    promoters,
    linkCount: links.length,
    links,
    promoterAudits: audits,
  }, { headers: { "cache-control": "no-store" } });
}
