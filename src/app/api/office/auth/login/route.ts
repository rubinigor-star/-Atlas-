import { NextResponse } from "next/server";
import { authenticateOfficeUser, createOfficeSession } from "@/lib/auth";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const result = await authenticateOfficeUser(email, password);
  if (!result.ok) return NextResponse.redirect(new URL(`/office/login?error=${result.error}`, request.url), 303);
  await createOfficeSession(result.user.id);
  return NextResponse.redirect(new URL("/office", request.url), 303);
}
