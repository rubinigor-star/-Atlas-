import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const link = await db.promoterLink.findUnique({ where: { code: code.toUpperCase() }, include: { event: true } });
  if (!link || !link.active || (link.startsAt && link.startsAt > new Date()) || (link.endsAt && link.endsAt < new Date())) {
    return NextResponse.redirect(new URL("/", url.origin));
  }

  const cookieName = `atlas_promoter_${link.id}`;
  const existing = req.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${cookieName}=`))?.split("=")[1];
  const sessionId = existing || randomUUID();
  await db.promoterLinkVisit.upsert({
    where: { linkId_sessionId: { linkId: link.id, sessionId } },
    update: {},
    create: {
      linkId: link.id,
      sessionId,
      source: req.headers.get("referer"),
      utmSource: url.searchParams.get("utm_source"),
      utmMedium: url.searchParams.get("utm_medium"),
      utmCampaign: url.searchParams.get("utm_campaign"),
      userAgent: req.headers.get("user-agent"),
    },
  });

  const target = new URL(`/events/${link.event.slug}`, url.origin);
  target.searchParams.set("ref", link.code);
  const response = NextResponse.redirect(target);
  if (!existing) response.cookies.set(cookieName, sessionId, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30, path: "/" });
  return response;
}
