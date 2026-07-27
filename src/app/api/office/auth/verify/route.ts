import { NextResponse } from "next/server";
import { markOfficeEmailVerified, verifyOfficeActionToken } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const payload = verifyOfficeActionToken(token, "verify");
  if (!payload) return NextResponse.redirect(new URL("/office/login?error=TOKEN_EXPIRED", request.url));
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || user.email.toLowerCase() !== payload.email) return NextResponse.redirect(new URL("/office/login?error=TOKEN_EXPIRED", request.url));
  await markOfficeEmailVerified(user.id);
  return NextResponse.redirect(new URL("/office/login?verified=1", request.url));
}
