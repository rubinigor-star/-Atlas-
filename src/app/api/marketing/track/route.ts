import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureMarketingRuntime } from "@/lib/marketing-runtime";

export async function POST(req: Request) {
  try {
    await ensureMarketingRuntime();
    const body = await req.json() as Record<string, unknown>;
    const sessionId = String(body.sessionId ?? "").slice(0, 120);
    if (!sessionId) return NextResponse.json({ ok: false }, { status: 400 });
    await db.$executeRawUnsafe(
      `INSERT INTO MarketingVisit (id, sessionId, eventId, source, medium, campaign, content, term, landingPath, referrer, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      crypto.randomUUID(), sessionId, body.eventId ? String(body.eventId).slice(0, 160) : null, body.source ? String(body.source).slice(0, 160) : null, body.medium ? String(body.medium).slice(0, 160) : null, body.campaign ? String(body.campaign).slice(0, 200) : null, body.content ? String(body.content).slice(0, 200) : null, body.term ? String(body.term).slice(0, 200) : null, body.landingPath ? String(body.landingPath).slice(0, 1000) : null, body.referrer ? String(body.referrer).slice(0, 1000) : null,
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
