import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { resetOfficePassword, verifyOfficeActionToken } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const token = String(form.get("token") || "");
  const password = String(form.get("password") || "");
  if (password.length < 10) return NextResponse.redirect(new URL(`/office/invite?token=${encodeURIComponent(token)}&error=WEAK_PASSWORD`, request.url), 303);
  const payload = verifyOfficeActionToken(token, "invite");
  if (!payload) return NextResponse.redirect(new URL("/office/login?error=TOKEN_EXPIRED", request.url), 303);
  const user = await db.user.findUnique({ where: { id: payload.userId } });
  if (!user || !user.active || user.email.toLowerCase() !== payload.email) return NextResponse.redirect(new URL("/office/login?error=TOKEN_EXPIRED", request.url), 303);
  await resetOfficePassword(user.id, password);
  return NextResponse.redirect(new URL("/office/login?invited=1", request.url), 303);
}
