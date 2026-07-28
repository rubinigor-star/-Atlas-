import { NextResponse } from "next/server";
import { getMobileStaff } from "@/lib/mobile-auth";

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
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
