import { NextResponse } from "next/server";
import {
  authenticateOfficeUser,
  ensureDemoOrganizerPlatform,
  officeSessionCookie,
} from "@/lib/auth";
import { createOfficeSessionToken, officeSessionTtlSeconds } from "@/lib/office-session-token";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  const result = await authenticateOfficeUser(email, password);

  if (!result.ok) {
    const target = new URL("/office/login", request.url);
    target.searchParams.set("error", result.error);
    if ("retryAfterSeconds" in result) target.searchParams.set("retryAfter", String(result.retryAfterSeconds));
    if ("remainingAttempts" in result) target.searchParams.set("attempts", String(result.remainingAttempts));
    return NextResponse.redirect(target, 303);
  }
  if (result.user.role === "ADMIN") await ensureDemoOrganizerPlatform();

  const response = NextResponse.redirect(new URL(result.user.role === "ADMIN" ? "/platform" : "/office", request.url), 303);
  response.cookies.set(officeSessionCookie, createOfficeSessionToken(result.user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: officeSessionTtlSeconds,
  });
  return response;
}
