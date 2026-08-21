import { NextResponse } from "next/server";
import { CART_SESSION_COOKIE } from "@/lib/cart-hold";
import { rememberPendingCheckoutOwner } from "@/lib/cart-checkout-owner";

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
    const sessionId = cookieValue(req, CART_SESSION_COOKIE);
    if (!sessionId) return NextResponse.json({ ok: false, reason: "NO_CART_SESSION" }, { status: 409 });
    const body = await req.json() as { orderId?: unknown };
    const orderPublicId = typeof body.orderId === "string" ? body.orderId : "";
    if (!orderPublicId) return NextResponse.json({ ok: false, reason: "ORDER_REQUIRED" }, { status: 400 });
    const owner = await rememberPendingCheckoutOwner({ sessionId, orderPublicId });
    return NextResponse.json({ ok: Boolean(owner) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось связать корзину с заказом" }, { status: 400 });
  }
}
