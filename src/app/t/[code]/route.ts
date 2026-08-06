import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resolveShortTicketCode } from "@/lib/short-ticket-link";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const publicId = await resolveShortTicketCode(code);
  if (!publicId) return NextResponse.redirect(new URL("/orders/not-found", request.url));

  const order = await db.order.findUnique({ where: { publicId }, select: { publicId: true, status: true } });
  if (!order || order.status !== "PAID") return NextResponse.redirect(new URL("/orders/not-found", request.url));

  return NextResponse.redirect(new URL(`/orders/${encodeURIComponent(order.publicId)}`, request.url), 302);
}
