import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { expireReservations } from "@/lib/reservation";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await db.$transaction((tx) => expireReservations(tx));
    return NextResponse.json({ ok: true, expired, checkedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reservation cleanup failed" },
      { status: 500 },
    );
  }
}
