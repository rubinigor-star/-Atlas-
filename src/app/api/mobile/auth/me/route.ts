import { NextResponse } from "next/server";
import { getMobileStaff } from "@/lib/mobile-auth";
import { z } from "zod";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staffRole: user.staffRole,
        jobTitle: user.jobTitle,
        organization: user.organization ? { id: user.organization.id, name: user.organization.name } : null,
        permissions: Array.from(user.permissionSet),
        eventIds: user.eventAccess.map((access) => access.eventId),
        staffLocale: user.staffLocale,
        localePreference: user.localePreference,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}

const updateSchema = z.object({ locale: z.enum(["ru", "he", "en"]) });

export async function PATCH(request: Request) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_LOCALE" }, { status: 400 });
  await db.user.update({ where: { id: user.id }, data: { interfaceLocaleOverride: parsed.data.locale } });
  return NextResponse.json({ ok: true, staffLocale: parsed.data.locale }, { headers: { "cache-control": "no-store" } });
}
