import { NextResponse } from "next/server";
import { getMobileStaff } from "@/lib/mobile-auth";
import { venueCatalog } from "@/lib/event-info-options";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getMobileStaff(request);
  if (!actor) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!actor.permissionSet.has("EVENT_VIEW") && !actor.permissionSet.has("EVENT_MANAGE")) {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  return NextResponse.json({
    venues: venueCatalog.map((venue) => ({
      name: venue.name,
      nameHe: venue.nameHe,
      city: venue.city,
      cityHe: venue.cityHe,
      address: venue.address,
      custom: venue.name === "Другой зал",
    })),
  });
}
