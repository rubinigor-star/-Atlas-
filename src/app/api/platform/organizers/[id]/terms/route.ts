import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentStaff } from "@/lib/auth";
import { saveOrganizerTerms } from "@/lib/commercial-terms";

const schema = z.object({
  salesFeePercentBps: z.number().int().min(0).max(10000),
  salesFeeFixedMinor: z.number().int().min(0).max(100000),
  serviceFeePayer: z.enum(["BUYER", "ORGANIZER"]),
  refundsEnabled: z.boolean(),
  refundFeePercentBps: z.number().int().min(0).max(10000),
  refundFeeFixedMinor: z.number().int().min(0).max(100000),
  refundDeadlineHours: z.number().int().min(0).max(8760),
  transferRefundWindowDays: z.number().int().min(0).max(365),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getCurrentStaff();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "INVALID_TERMS", details: parsed.error.flatten() }, { status: 400 });
  const terms = await saveOrganizerTerms(id, actor.id, parsed.data);
  return NextResponse.json({ terms });
}
