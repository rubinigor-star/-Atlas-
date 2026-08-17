import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CART_SESSION_COOKIE, releaseCartHold } from "@/lib/cart-hold";

export const dynamic = "force-dynamic";

function cookieValue(req: Request, name: string) {
  const raw = req.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return "";
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { eventSlug?: unknown };
    const eventSlug = typeof body.eventSlug === "string" ? body.eventSlug.trim() : "";
    if (!eventSlug) throw new Error("eventSlug обязателен");

    const event = await db.event.findFirst({ where: { slug: eventSlug }, select: { id: true } });
    const sessionId = cookieValue(req, CART_SESSION_COOKIE);
    if (!event || !sessionId) return NextResponse.json({ ok: true });

    await db.$transaction(async tx => releaseCartHold({ sessionId, eventId: event.id, executor: tx }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось снять бронь" }, { status: 400 });
  }
}
