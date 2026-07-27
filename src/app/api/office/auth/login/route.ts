import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  authenticateOfficeUser,
  createOfficeCredential,
  createOfficeSession,
  ensureOfficeAuthTable,
  verifyOfficePassword,
} from "@/lib/auth";

const PLATFORM_OWNER_EMAIL = "rubin.igor@gmail.com";
const PLATFORM_OWNER_BOOTSTRAP_HASH =
  "scrypt:fd023b8f75cb82ca56a70d7620d15a10:ccf89e606b7c6ed89027e2424a918891e2794fcd2ca396e67b85fca50698427598098af7f669cda460570acaf3120ed647ccefa147510c86be174819ed61f2b2";

async function bootstrapPlatformOwner(email: string, password: string) {
  if (email !== PLATFORM_OWNER_EMAIL || !verifyOfficePassword(password, PLATFORM_OWNER_BOOTSTRAP_HASH)) return;

  await ensureOfficeAuthTable();
  const organization = await db.organization.findFirst({ orderBy: { createdAt: "asc" } });
  const user = await db.user.upsert({
    where: { email },
    update: {
      name: "Igor Rubin",
      role: "ADMIN",
      staffRole: "ADMIN",
      jobTitle: "Platform Superuser",
      active: true,
      organizationId: organization?.id ?? null,
    },
    create: {
      name: "Igor Rubin",
      email,
      role: "ADMIN",
      staffRole: "ADMIN",
      jobTitle: "Platform Superuser",
      active: true,
      organizationId: organization?.id ?? null,
    },
  });

  await createOfficeCredential(user.id, password, true);
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

  if (!result.ok) return NextResponse.redirect(new URL(`/office/login?error=${result.error}`, request.url), 303);
  await createOfficeSession(result.user.id);
  return NextResponse.redirect(new URL("/office", request.url), 303);
}
