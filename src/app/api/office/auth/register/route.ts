import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createOfficeCredential } from "@/lib/auth";
import { rolePermissions } from "@/lib/permissions";
import { sendOrganizerVerification } from "@/lib/office-auth-email";

const schema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().transform(v => v.toLowerCase()),
  password: z.string().min(10).max(128),
  organizationName: z.string().trim().min(2).max(160),
  businessType: z.string().trim().min(2).max(80),
  country: z.string().trim().min(2).max(80),
  acceptedTerms: z.literal("on"),
});

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const input = schema.parse(Object.fromEntries(form));
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) return NextResponse.redirect(new URL("/office/register?error=EMAIL_EXISTS", request.url), 303);

    const created = await db.$transaction(async tx => {
      const organization = await tx.organization.create({ data: { name: input.organizationName } });
      const user = await tx.user.create({ data: {
        name: `${input.firstName} ${input.lastName}`,
        email: input.email,
        role: "ORGANIZER",
        staffRole: "OWNER",
        jobTitle: `Owner · ${input.businessType} · ${input.country} · ${input.phone}`,
        organizationId: organization.id,
        permissions: { create: rolePermissions.OWNER.map(permission => ({ permission })) },
      } });
      return user;
    });

    await createOfficeCredential(created.id, input.password, false);
    try { await sendOrganizerVerification(created.id, created.email); }
    catch (error) { console.error("[office-register] verification email failed", error); }
    return NextResponse.redirect(new URL("/office/login?registered=1", request.url), 303);
  } catch (error) {
    console.error("[office-register]", error);
    return NextResponse.redirect(new URL("/office/register?error=INVALID", request.url), 303);
  }
}
