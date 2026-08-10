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
  try {
    const { code } = await params;
    const input = schema.parse(await req.json());
    const link = await db.promoterLink.findUnique({ where: { code: code.toUpperCase() } });
    const now = new Date();
    if (!link || !link.active || link.eventId !== input.eventId || (link.startsAt && link.startsAt > now) || (link.endsAt && link.endsAt < now)) {
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
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
