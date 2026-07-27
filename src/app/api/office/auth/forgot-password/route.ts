import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendOrganizerPasswordReset } from "@/lib/office-auth-email";

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (user?.active) {
    try { await sendOrganizerPasswordReset(user.id, user.email); }
    catch (error) { console.error("[office-forgot-password]", error); }
  }
  return NextResponse.redirect(new URL("/office/forgot-password?sent=1", request.url), 303);
}
