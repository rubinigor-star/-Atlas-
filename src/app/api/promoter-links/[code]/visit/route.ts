import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  sessionId: z.string().min(8).max(120),
  eventId: z.string().min(1),
  source: z.string().max(160).optional().nullable(),
  utmSource: z.string().max(160).optional().nullable(),
  utmMedium: z.string().max(160).optional().nullable(),
  utmCampaign: z.string().max(200).optional().nullable(),
});

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  let code = "";
  try {
    ({ code } = await params);
    const input = schema.parse(await req.json());
    const normalizedCode = code.toUpperCase();
    const link = await db.promoterLink.findUnique({ where: { code: normalizedCode } });
    const now = new Date();
    if (!link || !link.active || link.eventId !== input.eventId || (link.startsAt && link.startsAt > now) || (link.endsAt && link.endsAt < now)) {
      console.warn("[promoter-visit] invalid link", { code: normalizedCode, eventId: input.eventId, found: Boolean(link), active: link?.active ?? null, linkEventId: link?.eventId ?? null });
      return NextResponse.json({ ok: false }, { status: 404 });
    }
    await db.promoterLinkVisit.upsert({
      where: { linkId_sessionId: { linkId: link.id, sessionId: input.sessionId } },
      update: {},
      create: {
        linkId: link.id,
        sessionId: input.sessionId,
        source: input.source || null,
        utmSource: input.utmSource || null,
        utmMedium: input.utmMedium || null,
        utmCampaign: input.utmCampaign || null,
        userAgent: req.headers.get("user-agent"),
      },
    });
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[promoter-visit] failed", { code: code.toUpperCase(), error });
    return NextResponse.json({ ok: false }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
