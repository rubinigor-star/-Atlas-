import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/auth";
import { getOrganizerTerms, saveOrganizerTerms } from "@/lib/commercial-terms";

const schema = z.object({
  salesFeePercentBps: z.number().int().min(0).max(10000),
  salesFeeFixedMinor: z.number().int().min(0).max(100000),
  serviceFeePayer: z.enum(["BUYER", "ORGANIZER"]),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentStaff();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TERMS", details: parsed.error.flatten() }, { status: 400 });

  const current = await getOrganizerTerms(id);
  const terms = await saveOrganizerTerms(id, actor.id, {
    salesFeePercentBps: parsed.data.salesFeePercentBps,
    salesFeeFixedMinor: parsed.data.salesFeeFixedMinor,
    serviceFeePayer: parsed.data.serviceFeePayer,
    // Legacy refund fields are preserved for historical compatibility only.
    // The active Cancellation module is the sole source of truth for refund policy and fees.
    refundsEnabled: current.refundsEnabled,
    refundFeePercentBps: current.refundFeePercentBps,
    refundFeeFixedMinor: current.refundFeeFixedMinor,
    refundDeadlineHours: current.refundDeadlineHours,
    transferRefundWindowDays: current.transferRefundWindowDays,
  });
  return NextResponse.json({ terms });
}
