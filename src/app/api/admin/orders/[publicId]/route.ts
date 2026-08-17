import { after, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireEventAccess } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { enqueueOrderReview, processOrderReviewJobs } from "@/lib/order-review-queue";
import { releaseReservation } from "@/lib/reservation";

const DISMISSED_EXPIRED_NOTE = "__DISMISSED_EXPIRED__";
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["approve", "reject"]), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("cancel") }),
]);

type AuthorizationRow={status:string;amountMinor:number;capturedAt:Date|null};

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
    const input = actionSchema.parse(await req.json());

    if(input.action==="cancel"){
      const target=await db.order.findUnique({where:{publicId},include:{items:true,tickets:true}});
      if(!target)throw new Error("Заказ не найден");
      const actor=await requireEventAccess("ORDER_MANAGE",target.eventId);
      if(target.status==="CANCELLED"||target.status==="REJECTED")return NextResponse.json({ok:true,status:target.status});
      if(target.tickets.some(ticket=>ticket.status==="USED"))throw new Error("Нельзя отменить заказ после прохода по билету");
      const authorization=await db.$queryRaw<AuthorizationRow[]>`SELECT status,"amountMinor","capturedAt" FROM "PaymentAuthorization" WHERE "orderId"=${target.id} LIMIT 1`.then(rows=>rows[0]);
      if(target.totalMinor>0&&(authorization?.capturedAt||target.status==="PAID"))throw new Error("По этому заказу были списаны деньги. Используйте возврат средств, а не обычную отмену.");
      const activeTickets=target.tickets.filter(ticket=>ticket.status!=="CANCELLED");
      const categoryCounts=new Map<string,number>();for(const ticket of activeTickets)categoryCounts.set(ticket.categoryId,(categoryCounts.get(ticket.categoryId)||0)+1);
      const seatIds=target.items.map(item=>item.seatId).filter((id):id is string=>Boolean(id));
      await db.$transaction(async tx=>{
        await releaseReservation(target.id,tx);
        await tx.ticket.updateMany({where:{orderId:target.id,status:{not:"CANCELLED"}},data:{status:"CANCELLED"}});
        await tx.order.update({where:{id:target.id},data:{status:"CANCELLED",paymentDueAt:null}});
        for(const [categoryId,count] of categoryCounts)await tx.ticketCategory.updateMany({where:{id:categoryId,sold:{gte:count}},data:{sold:{decrement:count}}});
        if(seatIds.length)await tx.seat.updateMany({where:{id:{in:seatIds},status:"RESERVED"},data:{status:"AVAILABLE"}});
      });
      await writeAudit(actor,{action:"ORDER_CANCELLED_NO_REFUND",entityType:"Order",entityId:target.id,summary:`Заказ ${publicId} отменён без возврата средств`,metadata:{publicId,totalMinor:target.totalMinor,authorizationStatus:authorization?.status??null}});
      return NextResponse.json({ok:true,status:"CANCELLED"});
    }

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
    console.error("admin.request.action_failed", {
      publicId,
      message: error instanceof Error ? error.message : "Unknown error",
      status: current?.status || null,
    });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ошибка обработки заказа", status: current?.status },
      { status: error instanceof Error && error.message === "FORBIDDEN" ? 403 : 400 },
    );
  }
}
