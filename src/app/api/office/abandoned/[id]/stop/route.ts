import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth";
import { stopAbandonedCheckoutReminders } from "@/lib/abandoned-maintenance";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const staff = await requirePermission("ANALYTICS_VIEW");
  const { id } = await params;
  const stopped = await stopAbandonedCheckoutReminders(id, staff.organizationId!);

  if (!stopped) {
    return NextResponse.json({ error: "CHECKOUT_NOT_ACTIVE" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
