import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  authenticateOfficeUser,
  createOfficeCredential,
  ensureOfficeAuthTable,
  officeSessionCookie,
  verifyOfficePassword,
} from "@/lib/auth";
import { createOfficeSessionToken, officeSessionTtlSeconds } from "@/lib/office-session-token";

const PLATFORM_OWNER_EMAIL = "rubin.igor@gmail.com";
const PLATFORM_OWNER_BOOTSTRAP_HASH =
  "scrypt:fd023b8f75cb82ca56a70d7620d15a10:ccf89e606b7c6ed89027e2424a918891e2794fcd2ca396e67b85fca50698427598098af7f669cda460570acaf3120ed647ccefa147510c86be174819ed61f2b2";

async function bootstrapPlatformOwner(email: string, password: string) {
  if (email !== PLATFORM_OWNER_EMAIL || !verifyOfficePassword(password, PLATFORM_OWNER_BOOTSTRAP_HASH)) return;
  await ensureOfficeAuthTable();
  const user = await db.user.upsert({
    where: { email },
    update: { name: "Igor Rubin", role: "ADMIN", staffRole: "ADMIN", jobTitle: "Platform Super Administrator", active: true, organizationId: null },
    create: { name: "Igor Rubin", email, role: "ADMIN", staffRole: "ADMIN", jobTitle: "Platform Super Administrator", active: true, organizationId: null },
  });
  await createOfficeCredential(user.id, password, true);
}

function logAuthResult(email: string, result: Awaited<ReturnType<typeof authenticateOfficeUser>>) {
  if (result.ok) {
    console.info("[office-auth] LOGIN_SUCCESS", { email, userId: result.user.id, role: result.user.role });
    return;
  }
  console.warn("[office-auth] LOGIN_FAILED", { email, reason: result.error });
}

export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  let result = await authenticateOfficeUser(email, password);
  if (!result.ok) {
    await bootstrapPlatformOwner(email, password);
    result = await authenticateOfficeUser(email, password);
  }

  logAuthResult(email, result);

  if (!result.ok) return NextResponse.redirect(new URL(`/office/login?error=${result.error}`, request.url), 303);

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
