import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getMobileStaff } from "@/lib/mobile-auth";
import { enqueueOrderReview, processOrderReviewJobs } from "@/lib/order-review-queue";

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
      select: { id: true, eventId: true, event: { select: { organizationId: true } } },
    });
    if (!order) return NextResponse.json({ error: "Заявка не найдена" }, { status: 404 });
    if (!canAccessEvent(user, order.eventId, order.event.organizationId)) {
      return NextResponse.json({ error: "EVENT_ACCESS_DENIED" }, { status: 403 });
    }

    const job = await enqueueOrderReview(publicId, input, user);
    after(async () => {
      try {
        await processOrderReviewJobs(3);
      } catch (error) {
        console.error("mobile.request.background_queue_failed", {
          publicId,
          message: error instanceof Error ? error.message : "Unknown queue error",
        });
      }
    });
    return NextResponse.json({ queued: true, processing: true, jobId: job.id, action: job.action }, { status: 202 });
  } catch (error) {
    const current = await db.order.findUnique({ where: { publicId }, select: { status: true } }).catch(() => null);
    console.error("mobile.request.review_enqueue_failed", {
      publicId,
      userId: user.id,
      message: error instanceof Error ? error.message : "Unknown error",
      status: current?.status || null,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка постановки заявки в очередь", status: current?.status },
      { status: 400 },
    );
  }
}
