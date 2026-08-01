import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureAbandonedCheckoutRuntime } from "@/lib/abandoned-checkout";

const schema = z.object({ token: z.string().uuid() });

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await ensureAbandonedCheckoutRuntime();
    await db.$executeRawUnsafe(
      `UPDATE "AbandonedCheckout"
       SET "lastActivityAt"=CURRENT_TIMESTAMP,"updatedAt"=CURRENT_TIMESTAMP
       WHERE "token"=$1 AND "status"='ACTIVE' AND "abandonedAt" IS NULL`,
      input.token,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "INVALID_REQUEST" }, { status: 400 });
  }
}
