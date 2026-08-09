import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { reviewOrder } from "@/lib/order-review-service";

const reviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(500).optional(),
});

function canAccessEvent(
  user: NonNullable<Awaited<ReturnType<typeof getMobileStaff>>>,
  eventId: string,
  organizationId: string,
) {
  if (user.role === "ADMIN") return true;
  if (!user.organizationId || user.organizationId !== organizationId) return false;
  const hasExplicitScope = user.eventAccess.length > 0;
  return !hasExplicitScope || user.eventAccess.some((access) => access.eventId === eventId);
}

export async function POST(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const user = await getMobileStaff(request);
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (user.role !== "ADMIN" && !user.permissionSet.has("REQUEST_REVIEW")) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { publicId } = await params;
  try {
    const input = reviewSchema.parse(await request.json());
    const order = await db.order.findUnique({
      where: { publicId },
      select: { eventId: true, event: { select: { organizationId: true } } },
    });
    if (!order) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    if (!canAccessEvent(user, order.eventId, order.event.organizationId)) {
      return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
    }

    const result = await reviewOrder(publicId, input, user);
    return NextResponse.json(result);
  } catch (error) {
    const current = await db.order.findUnique({ where: { publicId }, select: { status: true } }).catch(() => null);
    console.error("mobile.request.review_failed", {
      publicId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
      status: current?.status || null,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка проверки заявки", status: current?.status },
      { status: 400 },
    );
  }
}
