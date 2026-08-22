import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentStaff, requirePermission } from "@/lib/auth";
import { resolveStaffLocale } from "@/lib/i18n";

const schema = z.object({
  mode: z.enum(["self", "organization"]),
  locale: z.enum(["ru", "he", "en"]),
});

export async function PATCH(request: Request) {
  try {
    const input = schema.parse(await request.json());
    if (input.mode === "organization") {
      const actor = await requirePermission("TEAM_MANAGE");
      if (!actor.organizationId) throw new Error("FORBIDDEN");
      await db.organization.update({
        where: { id: actor.organizationId },
        data: { defaultStaffLocale: input.locale },
      });
      return NextResponse.json({ ok: true, defaultStaffLocale: input.locale });
    }

    const staff = await getCurrentStaff();
    if (!staff) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const updated = await db.user.update({
      where: { id: staff.id },
      data: { interfaceLocaleOverride: input.locale },
      include: { organization: true },
    });
    return NextResponse.json({
      ok: true,
      staffLocale: resolveStaffLocale({
        memberOverride: updated.interfaceLocaleOverride,
        userPreference: updated.preferredLocale,
        organizationDefault: updated.organization?.defaultStaffLocale,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "INVALID_REQUEST";
    return NextResponse.json({ error: message }, { status: message === "FORBIDDEN" ? 403 : 400 });
  }
}
