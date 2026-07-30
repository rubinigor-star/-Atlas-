import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ensureOfficeAuthTable } from "@/lib/auth";
import { sendOrganizerVerification } from "@/lib/office-auth-email";

const schema = z.object({ email: z.string().trim().email().transform(value => value.toLowerCase()) });

type CredentialRow = { emailVerifiedAt: Date | null };

export async function POST(request: Request) {
  const form = await request.formData();
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return NextResponse.redirect(new URL("/office/login?verification=invalid", request.url), 303);

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user || user.role !== "ORGANIZER") return NextResponse.redirect(new URL("/office/login?verification=resent", request.url), 303);

  await ensureOfficeAuthTable();
  const credentials = await db.$queryRawUnsafe<CredentialRow[]>(`SELECT "emailVerifiedAt" FROM "OfficeCredential" WHERE "userId"=$1 LIMIT 1`, user.id);
  if (credentials[0]?.emailVerifiedAt) return NextResponse.redirect(new URL("/office/login?verification=already", request.url), 303);

  try {
    await sendOrganizerVerification(user.id, user.email);
    return NextResponse.redirect(new URL("/office/login?verification=resent", request.url), 303);
  } catch (error) {
    console.error("[office-resend-verification]", error);
    return NextResponse.redirect(new URL("/office/login?verification=failed", request.url), 303);
  }
}
