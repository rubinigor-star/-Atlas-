import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { createOfficeCredential } from "@/lib/auth";
import { rolePermissions } from "@/lib/permissions";
import { sendOrganizerVerification } from "@/lib/office-auth-email";
import { recordOrganizerAgreementAcceptance } from "@/lib/organizer-compliance";

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

function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || null;
}

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
      return { user, organization };
    });

    await Promise.all([
      createOfficeCredential(created.user.id, input.password, false),
      recordOrganizerAgreementAcceptance({
        organizationId: created.organization.id,
        businessType: input.businessType,
        country: input.country,
        phone: input.phone,
        signerName: created.user.name,
        signerEmail: created.user.email,
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      }),
    ]);

    try {
      await sendOrganizerVerification(created.user.id, created.user.email);
      return NextResponse.redirect(new URL("/office/login?registered=1&verification=sent", request.url), 303);
    } catch (error) {
      console.error("[office-register] verification email failed", error);
      return NextResponse.redirect(new URL("/office/login?registered=1&verification=failed", request.url), 303);
    }
  } catch (error) {
    console.error("[office-register]", error);
    return NextResponse.redirect(new URL("/office/register?error=INVALID", request.url), 303);
  }
}
