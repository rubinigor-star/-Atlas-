import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { findPromoterChannelV2, trackPromoterVisitV2 } from "@/lib/promoter-v2";

const schema = z.object({
  sessionId: z.string().min(8).max(120),
  eventId: z.string().min(1).optional(),
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

    const v2=await findPromoterChannelV2(normalizedCode);
    if(v2){
      const ok=await trackPromoterVisitV2({code:normalizedCode,eventId:input.eventId||v2.eventId,sessionId:input.sessionId,source:input.source,utmSource:input.utmSource,utmMedium:input.utmMedium,utmCampaign:input.utmCampaign,userAgent:req.headers.get("user-agent")});
      return NextResponse.json({ok,source:"V2"},{status:ok?200:404,headers:{"cache-control":"no-store"}});
    }

    const link = await db.promoterLink.findUnique({ where: { code: normalizedCode } });
    const now = new Date();
    const eventId=input.eventId||link?.eventId;
    if (!link || !eventId || !link.active || link.eventId !== eventId || (link.startsAt && link.startsAt > now) || (link.endsAt && link.endsAt < now)) {
      return NextResponse.json({ ok: false }, { status: 404, headers: { "cache-control": "no-store" } });
    }
    await db.promoterLinkVisit.upsert({
      where: { linkId_sessionId: { linkId: link.id, sessionId: input.sessionId } },
      update: {},
      create: { linkId: link.id, sessionId: input.sessionId, source: input.source || null, utmSource: input.utmSource || null, utmMedium: input.utmMedium || null, utmCampaign: input.utmCampaign || null, userAgent: req.headers.get("user-agent") },
    });
    return NextResponse.json({ ok: true,source:"LEGACY" }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[promoter-visit] failed", { code: code.toUpperCase(), error });
    return NextResponse.json({ ok: false }, { status: 400, headers: { "cache-control": "no-store" } });
  }
}
