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
  "scrypt:e42cffcadc4e29e3e6bccab28b319a17:b22fa23c0a17b85f9ad7abc0084d683a3cb8a456a004f765b1282763aedc9736a0809c62e94cc5ce43def61fd747958fa37814dc70d6f2bf5dd9d6f548a83bf5";

async function bootstrapPlatformOwner(email: string, password: string) {
  if (email !== PLATFORM_OWNER_EMAIL || !verifyOfficePassword(password, PLATFORM_OWNER_BOOTSTRAP_HASH)) return;

  await ensureOfficeAuthTable();
  const existingCredential = await db.$queryRawUnsafe<Array<{ userId: string }>>(
    `SELECT c."userId" FROM "OfficeCredential" c JOIN "User" u ON u."id" = c."userId" WHERE u."email" = $1 LIMIT 1`,
    email,
  );
  if (existingCredential.length > 0) return;

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
