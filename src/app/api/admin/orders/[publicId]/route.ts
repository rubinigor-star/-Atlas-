import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { enqueueOrderReview, processOrderReviewJobs } from "@/lib/order-review-queue";

const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";
const reviewSchema = z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional() });

async function assertApprovalOrder(orderId: string) {
  const rows = await db.$queryRawUnsafe<Array<{ salesFlow: string }>>(
    `SELECT "salesFlow" FROM "Order" WHERE "id"=$1 LIMIT 1`,
    orderId,
  );
  if (rows[0]?.salesFlow !== "APPROVAL") throw new Error("Этот заказ не относится к заявкам");
}

export async function DELETE(_: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  try {
    const target = await db.order.findUnique({
      where: { publicId },
      select: { id: true, eventId: true, customerName: true, status: true, _count: { select: { tickets: true } } },
    });
    if (!target) throw new Error("Заявка не найдена");
    await assertApprovalOrder(target.id);
    const actor = await requireEventAccess("REQUEST_REVIEW", target.eventId);
    if (target.status !== "CANCELLED" && target.status !== "REJECTED") {
      throw new Error("Удалить из очереди можно только отменённую или отклонённую заявку");
    }
    if (target._count.tickets > 0) throw new Error("Заявку с выпущенными билетами нельзя удалить из очереди");
    await db.order.update({
      where: { id: target.id },
      data: { reviewNote: DISMISSED_EXPIRED_NOTE, reviewedAt: new Date(), paymentDueAt: null },
    });
    await writeAudit(actor, {
      action: "REQUEST_DISMISSED",
      entityType: "Order",
      entityId: target.id,
      summary: `Заявка ${target.customerName} удалена из рабочей очереди`,
      metadata: { publicId },
    });
    return NextResponse.json({ status: target.status, dismissed: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось удалить заявку из очереди" },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  try {
    const input = reviewSchema.parse(await req.json());
    const target = await db.order.findUnique({ where: { publicId }, select: { id: true, eventId: true } });
    if (!target) throw new Error("Заявка не найдена");
    await assertApprovalOrder(target.id);
    const actor = await requireEventAccess("REQUEST_REVIEW", target.eventId);
    const job = await enqueueOrderReview(publicId, input, actor);

    after(async () => {
      try {
        await processOrderReviewJobs(3);
      } catch (error) {
        console.error("admin.request.background_queue_failed", {
          publicId,
          message: error instanceof Error ? error.message : "Unknown queue error",
        });
      }
    });

    return NextResponse.json({
      queued: true,
      processing: true,
      jobId: job.id,
      action: job.action,
      status: job.action === "approve" ? "PROCESSING_APPROVE" : "PROCESSING_REJECT",
    }, { status: 202 });
  } catch (error) {
    const current = await db.order.findUnique({ where: { publicId }, select: { status: true } }).catch(() => null);
    console.error("admin.request.review_enqueue_failed", {
      publicId,
      message: error instanceof Error ? error.message : "Unknown error",
      status: current?.status || null,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка постановки заявки в очередь", status: current?.status },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
